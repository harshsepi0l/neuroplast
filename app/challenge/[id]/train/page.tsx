import { TrainingView } from "@/features/challenges/ui/training-view";

export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  return <TrainingView id={(await params).id}/>;
}
