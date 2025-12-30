"use client";

import { useState, useRef } from "react";
import jsPDF from "jspdf";

interface AgendaItem {
  title: string;
  summary: string;
  slideImage?: string;
}

export default function Home() {
  const [documentUrl, setDocumentUrl] = useState("");
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const slidesRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentUrl) {
      alert("GoogleドキュメントのURLを入力してください");
      return;
    }

    setLoading(true);
    setAgendaItems([]);
    setProgress(0);

    try {
      // Step 1: ドキュメントの内容を取得
      setCurrentStep("ドキュメントを取得中...");
      const fetchRes = await fetch("/api/fetch-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentUrl }),
      });

      if (!fetchRes.ok) {
        const error = await fetchRes.json();
        throw new Error(error.error || "ドキュメントの取得に失敗しました");
      }

      const { content } = await fetchRes.json();
      setProgress(15);

      // Step 2: 議題を抽出して要約
      setCurrentStep("議題を抽出・要約中...");
      const summarizeRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!summarizeRes.ok) {
        const error = await summarizeRes.json();
        throw new Error(error.error || "要約に失敗しました");
      }

      const { agendas } = await summarizeRes.json();
      setProgress(30);

      // Step 3: 各議題のグラレコ風スライドを生成
      const itemsWithSlides: AgendaItem[] = [];
      for (let i = 0; i < agendas.length; i++) {
        const agenda = agendas[i];
        setCurrentStep(`スライド生成中 (${i + 1}/${agendas.length}): ${agenda.title}`);

        const slideRes = await fetch("/api/generate-slide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: agenda.title,
            summary: agenda.summary,
          }),
        });

        if (!slideRes.ok) {
          const error = await slideRes.json();
          throw new Error(error.error || "スライド生成に失敗しました");
        }

        const { imageBase64 } = await slideRes.json();
        itemsWithSlides.push({
          ...agenda,
          slideImage: imageBase64,
        });

        setAgendaItems([...itemsWithSlides]);
        setProgress(30 + Math.round((70 * (i + 1)) / agendas.length));
      }

      setCurrentStep("完了!");
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (agendaItems.length === 0) return;

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "px",
      format: [1920, 1080],
    });

    for (let i = 0; i < agendaItems.length; i++) {
      const item = agendaItems[i];
      if (item.slideImage) {
        if (i > 0) {
          pdf.addPage([1920, 1080], "landscape");
        }
        pdf.addImage(item.slideImage, "PNG", 0, 0, 1920, 1080);
      }
    }

    pdf.save("meeting-slides.pdf");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            議事録スライド生成ツール
          </h1>
          <p className="text-gray-600">
            会議の議事録からグラレコ風スライドを自動生成
          </p>
        </header>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GoogleドキュメントのURL
            </label>
            <input
              type="url"
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="https://docs.google.com/document/d/..."
            />
            <p className="mt-2 text-sm text-gray-500">
              ※ ドキュメントを「リンクを知っている全員が閲覧可能」に設定してください
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {loading ? "処理中..." : "スライドを生成"}
          </button>

          {loading && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{currentStep}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </form>

        {agendaItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                生成されたスライド ({agendaItems.length}枚)
              </h2>
              <button
                onClick={downloadPDF}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                PDFをダウンロード
              </button>
            </div>

            <div ref={slidesRef} className="space-y-6">
              {agendaItems.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2">
                    <h3 className="font-semibold text-gray-800">
                      スライド {index + 1}: {item.title}
                    </h3>
                  </div>
                  {item.slideImage ? (
                    <img
                      src={item.slideImage}
                      alt={`スライド ${index + 1}`}
                      className="w-full"
                    />
                  ) : (
                    <div className="p-4 text-gray-600">
                      <p className="font-medium mb-2">{item.title}</p>
                      <p>{item.summary}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
