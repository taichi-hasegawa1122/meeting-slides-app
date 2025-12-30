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
以下の議事録から、重要な議題を**最大5つ**に絞って抽出・要約してください。

要件：
- 議題は最大5つまで（類似の議題は統合する）
- 各議題のタイトルは短く簡潔に（10文字以内推奨）
- 要約は箇条書きで3点以内、各ポイントは20文字以内
- 図解で表現しやすいシンプルな内容にする

必ず以下のJSON形式で出力してください。他のテキストは含めないでください：
{
  "agendas": [
    {
      "title": "短いタイトル",
      "summary": "ポイント1。ポイント2。ポイント3"
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
