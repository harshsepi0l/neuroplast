import { TrainingView } from "@/domains/challenges/presentation/training-view";

export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  return <TrainingView id={(await params).id}/>;
}
