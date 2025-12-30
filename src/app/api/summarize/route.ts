import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEYが設定されていません" },
        { status: 500 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: "議事録の内容が必要です" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `あなたは会議の議事録を分析するアシスタントです。
以下の議事録から、各議題（アジェンダ）を抽出し、それぞれを簡潔に要約してください。

要約は以下の形式で出力してください：
- 各議題のタイトル
- その議題の主要なポイント（箇条書きで3-5点）
- 決定事項やアクションアイテムがあれば記載

必ず以下のJSON形式で出力してください。他のテキストは含めないでください：
{
  "agendas": [
    {
      "title": "議題のタイトル",
      "summary": "要約内容（主要ポイントを含む）"
    }
  ]
}

議事録：
${content}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("有効なJSONが返されませんでした");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    console.log("=== 要約結果 ===");
    parsed.agendas.forEach((agenda: { title: string; summary: string }, index: number) => {
      console.log(`\n【議題 ${index + 1}】`);
      console.log(`タイトル: ${agenda.title}`);
      console.log(`要約: ${agenda.summary}`);
    });
    console.log("================\n");

    return NextResponse.json({ agendas: parsed.agendas });
  } catch (error) {
    console.error("Summarize error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "要約に失敗しました" },
      { status: 500 }
    );
  }
}
