import Groq from "groq-sdk";
import { tavily } from "@tavily/core";
import NodeCache from "node-cache"; //it can store the data in the memory for a certain time
//it stores data as key-value pair eg. {key: value}

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const cache = new NodeCache({ stdTTL: 60 * 60 * 24 }); // means can remember the data for 24 hours, after 24 hours the entry or message will be deleted
//for storing all messages need to used database

export async function generate(userMessage, threadId) {
  const baseMessages = [
    {
      role: "system",
      content: `You are a smart personal assistant.
                    If you know the answer to a question, answer it directly in plain English.
                    If the answer requires real-time, local, or up-to-date information, or if you don’t know the answer, use the available tools to find it.
                    You have access to the following tool:
                    searchWeb(query: string): Use this to search the internet for current or unknown information.
                    Decide when to use your own knowledge and when to use the tool.
                    Do not mention the tool unless needed.

                    Examples:
                    Q: What is the capital of Nepal?
                    A: The capital of Nepal is Kathmandu.

                    Q: What’s the weather in Pokhara right now?
                    A: (use the search tool to find the latest weather)
                    
                    Q: Tell me the latest IT news.
                    A: (use the search tool to get the latest news)

                    current date and time: ${new Date().toUTCString()}`,
    },
  ];

  const messages = cache.get(threadId) ?? baseMessages;// getting user messages from cache or using baseMessages

  messages.push({
    role: "user",
    content: userMessage,
  });

  const MAX_RETRIES = 10;
  let count = 0;

  while (true) {
    if (count > MAX_RETRIES) {
      return "I Could not find the result, please try again";
    }
    count++;

    const completions = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      messages: messages,
      tools: [
        {
          type: "function",
          function: {
            name: "searchWeb",
            description:
              "Search the latest information and realtime data on the internet.",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query to perform search on.",
                },
              },
              required: ["query"],
            },
          },
        },
      ],
      tool_choice: "auto",
    });

    messages.push(completions.choices[0].message);

    const toolCalls = completions.choices[0].message.tool_calls;

    if (!toolCalls) {
      cache.set(threadId, messages); // here threadId is the key and messages is the value, threadId is userId here
      //eg.{userId: [messages]} means storing the current user messages to userId
      return completions.choices[0].message.content;
    }

    for (const tool of toolCalls) {
      const functionName = tool.function.name;
      const functionParams = tool.function.arguments;

      if (functionName === "searchWeb") {
        const toolResult = await webSearch(JSON.parse(functionParams));

        messages.push({
          tool_call_id: tool.id,
          role: "tool",
          name: functionName,
          content: toolResult,
        });
      }
    }
  }
}
async function webSearch({ query }) {
  // Here we will do tavily api call
  console.log("Calling web search...");

  const response = await tvly.search(query);
  // console.log('Response: ', response);

  const finalResult = response.results
    .map((result) => result.content)
    .join("\n\n");

  return finalResult;
}
