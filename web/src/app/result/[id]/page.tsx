import ResultClient from "./ResultClient";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  return <ResultClient key={(await params).id} sessionId={(await params).id} />;
}
