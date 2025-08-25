import readline from "node:readline/promises";
import Groq from "groq-sdk";
import { tavily } from "@tavily/core";

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });


    // Answer user questions clearly and concisely using simple language. 
    // Provide structured, easy-to-read responses with examples when helpful. 
    // Give the answer in one line.

  const messages1 = [
    {
      role: "system",
      content: `You are a smart personal assistant who answers the asked questions.`,
    },
    {
      role: "user",
      content: "what is javascript?",
    },
  ];

  const completions = await groq.chat.completions.create({
    temperature: 0,
    messages: messages1,
    model: "llama-3.3-70b-versatile",
  });

  console.log(completions.choices[0].message.content);

  // const messages2 = [
  //   {
  //     role: "system",
  //     content: `You are a smart personal assistant who answers the asked questions.
  //               You have access to following tools:
  //               1. searchWeb({query}: {query: string}) //Search the latest information and realtime data on the internet.
  //               current date and time: ${new Date().toUTCString()}`,
  //   },
  // ];

  // while (true) {
  //   const question = await rl.question("You: ");
  //   // bye
  //   if (question === "bye") {
  //     break;
  //   }

  //   messages2.push({
  //     role: "user",
  //     content: question,
  //   });

  //   while (true) {
  //     const completions = await groq.chat.completions.create({
  //       model: "llama-3.3-70b-versatile",
  //       temperature: 0,
  //       messages: messages2,
  //       tools: [
  //         {
  //           type: "function",
  //           function: {
  //             name: "webSearch",
  //             description:
  //               "Search the latest information and realtime data on the internet.",
  //             parameters: {
  //               type: "object",
  //               properties: {
  //                 query: {
  //                   type: "string",
  //                   description: "The search query to perform search on.",
  //                 },
  //               },
  //               required: ["query"],
  //             },
  //           },
  //         },
  //       ],
  //       tool_choice: "auto",
  //     });

  //     messages2.push(completions.choices[0].message);

  //     const toolCalls = completions.choices[0].message.tool_calls;

  //     if (!toolCalls) {
  //       console.log(`Assistant: ${completions.choices[0].message.content}`);
  //       break;
  //     }

  //     for (const tool of toolCalls) {
  //       // console.log('tool: ', tool);
  //       const functionName = tool.function.name;
  //       const functionParams = tool.function.arguments;

  //       if (functionName === "webSearch") {
  //         const toolResult = await webSearch(JSON.parse(functionParams));

  //         messages2.push({
  //           tool_call_id: tool.id,
  //           role: "tool",
  //           name: functionName,
  //           content: toolResult,
  //         });
  //       }
  //     }
  //   }
  // }

  rl.close();
}

main();

async function webSearch({ query }) {
  const response = await tvly.search(query);

  return response.results.map((result) => result.content).join("\n\n");
}
