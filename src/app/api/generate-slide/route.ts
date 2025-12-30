import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { title, summary } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEYが設定されていません" },
        { status: 500 }
      );
    }

    if (!title || !summary) {
      return NextResponse.json(
        { error: "タイトルと要約が必要です" },
        { status: 400 }
      );
    }

    const prompt = `ビジネススライドを作成してください。

タイトル: ${title}

内容: ${summary}

要件:
- サイズ：1920×1080（横長）
- 左側または上部：テキストでの説明（箇条書き）
- 右側または下部：内容を視覚化した図解
- タイトルは上部に大きく配置
- 日本語テキストは明瞭で読みやすいフォント
- 図解は矢印、図形、アイコンを使用
- 配色は青・白・グレーを基調にプロフェッショナルに
- 余白を適度に取り、見やすく整理`;

    console.log("=== スライド生成リクエスト ===");
    console.log(`タイトル: ${title}`);
    console.log(`要約: ${summary}`);
    console.log("==============================\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API error:", errorData);
      throw new Error(
        errorData.error?.message || "画像生成に失敗しました"
      );
    }

    const data = await response.json();

    // 画像データを抽出
    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("画像が生成されませんでした");
    }

    const parts = candidates[0].content?.parts;
    if (!parts) {
      throw new Error("レスポンスに画像データがありません");
    }

    // 画像パートを探す
    const imagePart = parts.find(
      (part: { inlineData?: { mimeType: string; data: string } }) =>
        part.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart || !imagePart.inlineData) {
      throw new Error("画像データが見つかりません");
    }

    const imageBase64 = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;

    return NextResponse.json({ imageBase64 });
  } catch (error) {
    console.error("Generate slide error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "スライド生成に失敗しました",
      },
      { status: 500 }
    );
  }
}
