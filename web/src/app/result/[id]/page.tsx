import ResultClient from "./ResultClient";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  return <ResultClient sessionId={(await params).id} />;
}
