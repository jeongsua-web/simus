import StatisticsClient from "./StatisticsClient";

export default async function StatisticsPage({ params }: { params: Promise<{ id: string }> }) {
  return <StatisticsClient sessionId={(await params).id} />;
}
