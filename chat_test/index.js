import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

// const token = process.env["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"];
const token = "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";
export async function main() {
    const client = ModelClient(
        "https://models.inference.ai.azure.com",
        new AzureKeyCredential(token)
    );

    const response = await client.path("/chat/completions").post({
        body: {
            messages: [
                { role: "user", content: "Give me roadmap for a Solana developer!" }
            ],
            model: "DeepSeek-R1",
            max_tokens: 2048,
        }
    });

    if (isUnexpected(response)) {
        throw response.body.error;
    }
    console.log(response.body.choices[0].message.content);
}

main().catch((err) => {
    console.error("The sample encountered an error:", err);
});
