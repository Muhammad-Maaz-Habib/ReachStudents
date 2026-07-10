type ThreadTopic = "GENERAL" | "INCIDENT" | "HEALTH";

export function isSensitiveParentThread(thread: {
  topic: ThreadTopic;
  incidentId?: string | null;
  medicalProfileId?: string | null;
}) {
  return (
    thread.topic === "INCIDENT" ||
    thread.topic === "HEALTH" ||
    !!thread.incidentId ||
    !!thread.medicalProfileId
  );
}

export function parentThreadDeliveryNote(topic: ThreadTopic) {
  if (topic === "GENERAL") {
    return "Full message text is sent via SMS/email to the guardian on file.";
  }
  return "Sensitive thread — SMS/email sends a notification with a link to the app only (no message content).";
}
