import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { documentUrl } = await request.json();

    if (!documentUrl) {
      return NextResponse.json(
        { error: "ドキュメントURLが必要です" },
        { status: 400 }
      );
    }

    // GoogleドキュメントのIDを抽出
    const docIdMatch = documentUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!docIdMatch) {
      return NextResponse.json(
        { error: "有効なGoogleドキュメントURLではありません" },
        { status: 400 }
      );
    }

    const docId = docIdMatch[1];
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

    const response = await fetch(exportUrl);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("ドキュメントが見つかりません");
      }
      if (response.status === 403) {
        throw new Error("アクセス権限がありません。ドキュメントを「リンクを知っている全員が閲覧可能」に設定してください");
      }
      throw new Error(`ドキュメントの取得に失敗しました: ${response.status}`);
    }

    const content = await response.text();

    if (!content || content.trim().length === 0) {
      throw new Error("ドキュメントが空です");
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Fetch document error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ドキュメントの取得に失敗しました",
      },
      { status: 500 }
    );
  }
}
