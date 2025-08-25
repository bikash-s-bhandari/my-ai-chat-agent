import Groq from "groq-sdk";
import express from "express";
import cors from 'cors';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const app = express();
app.use(express.json());
app.use(cors());


// ======== Fake DB (replace with your real DB calls) =========
const departments = [
  { id: "d1", name: "Cardiology" },
  { id: "d2", name: "Neurology" },
  { id: "d3", name: "Orthopedics" },
  { id: "d4", name: "ENT" },
];
const doctors = [
  { id: "u1", name: "Dr. A. Sharma", departmentId: "d1" },
  { id: "u2", name: "Dr. B. Koirala", departmentId: "d1" },
  { id: "u3", name: "Dr. C. Gurung", departmentId: "d2" },
  { id: "u4", name: "Dr. D. Thapa", departmentId: "d3" },
  { id: "u5", name: "Dr. Neerja KC", departmentId: "d4" },
];
const slots = [
  { doctorId: "u1", date: "2025-08-24", time: "10:00", available: true },
  { doctorId: "u1", date: "2025-08-24", time: "14:00", available: true },
  { doctorId: "u2", date: "2025-08-25", time: "11:30", available: true },
  { doctorId: "u3", date: "2025-08-24", time: "15:00", available: false },
  { doctorId: "u4", date: "2025-08-26", time: "09:30", available: true },
  { doctorId: "u5", date: "2025-08-24", time: "09:00", available: true },
  { doctorId: "u5", date: "2025-08-24", time: "13:00", available: true },
  { doctorId: "u5", date: "2025-08-25", time: "10:30", available: true },
  { doctorId: "u5", date: "2025-08-26", time: "14:30", available: true },
];




// "DB" API
async function dbListDepartments() {
    return departments;
  }
  async function dbListDoctorsByDepartment(departmentName) {
    const dep = departments.find(d => d.name.toLowerCase() === departmentName.toLowerCase());
    if (!dep) return [];
    return doctors.filter(x => x.departmentId === dep.id);
  }
  async function dbGetDoctorSchedule(doctorName) {
    const doc = doctors.find(d => d.name.toLowerCase() === doctorName.toLowerCase());
    if (!doc) return [];
    return slots.filter(s => s.doctorId === doc.id && s.available);
  }
  async function dbBookAppointment(doctorName, date, time) {
    const doc = doctors.find(d => d.name.toLowerCase() === doctorName.toLowerCase());
    if (!doc) return { ok: false, reason: "Doctor not found" };
    const slot = slots.find(s => s.doctorId === doc.id && s.date === date && s.time === time && s.available);
    if (!slot) return { ok: false, reason: "Slot not available" };
    slot.available = false;
    return { ok: true, bookingId: `BK-${Date.now()}`, doctorId: doc.id, date, time };
  }

  

  // ======== Tool definitions (JSON schemas) =========
const tools = [
    {
      type: "function",
      function: {
        name: "list_departments",
        description: "List all medical departments in the hospital.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "list_doctors_by_department",
        description: "List doctors for a given department name.",
        parameters: {
          type: "object",
          properties: {
            department: { type: "string", description: "Department name, e.g., Cardiology" }
          },
          required: ["department"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_doctor_schedule",
        description: "Get available appointment slots for a doctor by name.",
        parameters: {
          type: "object",
          properties: {
            doctor_name: { type: "string", description: "Doctor's full name" }
          },
          required: ["doctor_name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "book_appointment",
        description: "Book an appointment with a doctor at a specific date and time.",
        parameters: {
          type: "object",
          properties: {
            doctor_name: { type: "string" },
            date: { type: "string", description: "YYYY-MM-DD" },
            time: { type: "string", description: "HH:mm" }
          },
          required: ["doctor_name", "date", "time"]
        }
      }
    },
  ];



  // ======== Chat endpoint =========
app.post("/chat", async (req, res) => {
  const userText = req.body?.message;
 
  if (!userText) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  // You'd normally keep per-user history in a DB/session:
  const messages = [
    {
      role: "system",
      content:
        "You are a warm, professional hospital chat agent for Sunrise Hospital. You can greet users and engage in basic conversation, but your main purpose is to help with hospital services, medical appointments, departments, doctors, and healthcare. When listing services, departments, doctors, appointment slots, or any other information, always format them in bullet points (•) for better readability. If a user asks about anything unrelated to the hospital (like sports, cooking, entertainment, etc.), politely redirect them by saying something like: 'I'm here to help with hospital-related questions only. I can assist you with appointments, departments, doctors, or other medical services. How can I help you with your healthcare needs?' For greetings like 'hi', 'hello', etc., respond warmly and briefly mention how you can help with hospital services. Keep responses concise, professional, and focused on healthcare services."
    },
    { role: "user", content: userText }
  ];
  const reply = await runWithTools(messages);
  res.json({ message: reply });
});
// Core loop: call LLM; if it asks to call a tool, execute, append, and continue once
async function runWithTools(messages) {
  // First turn
  let result = await groq.chat.completions.create({
    model: "llama3-70b-8192",
    messages,
    tools,
    tool_choice: "auto",
    temperature: 0.2
  });
  let message = result.choices[0].message;
  if (message.tool_calls && message.tool_calls.length > 0) {
    // Execute each tool call and append results
    for (const call of message.tool_calls) {
      const name = call.function?.name;
      const args = safeJSON(call.function?.arguments);
      let toolResult;
      if (name === "list_departments") {
        toolResult = await dbListDepartments();
      } else if (name === "list_doctors_by_department") {
        toolResult = await dbListDoctorsByDepartment(args.department);
      } else if (name === "get_doctor_schedule") {
        toolResult = await dbGetDoctorSchedule(args.doctor_name);
      } else if (name === "book_appointment") {
        toolResult = await dbBookAppointment(args.doctor_name, args.date, args.time);
      } else {
        toolResult = { error: `Unknown tool: ${name}` };
      }
      messages.push(message); // assistant with tool_calls
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(toolResult)
      });
    }
    // Ask the model to compose the final natural-language answer
    const final = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages,
      temperature: 0.2
    });
    return final.choices[0].message?.content ?? "(No response)";
  }
  // No tool call—model answered directly
  return message.content ?? "(No response)";
}
function safeJSON(s) {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}

const port = 3001;
app.listen(port, () => {
  console.log(`Hospital agent running on http://localhost:${port}`);
});