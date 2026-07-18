export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  tag: "Core" | "Premium" | "AI Native" | "Utility";
  icon: string;
}

export const COMPONENT_CATALOG: CatalogItem[] = [
  {
    id: "interactive-map",
    title: "Interactive Map",
    description: "Embed location-aware maps with markers and geofencing.",
    tag: "Core",
    icon: "🗺",
  },
  {
    id: "kanban-board",
    title: "Kanban Board",
    description: "Drag-and-drop task boards with swimlanes and WIP limits.",
    tag: "Premium",
    icon: "📋",
  },
  {
    id: "ai-sentiment",
    title: "AI Sentiment Analysis",
    description: "Analyze text feedback with on-device sentiment scoring.",
    tag: "AI Native",
    icon: "✨",
  },
  {
    id: "signature-pad",
    title: "Signature Pad",
    description: "Capture legally binding signatures on mobile and desktop.",
    tag: "Utility",
    icon: "✍",
  },
  {
    id: "barcode-scanner",
    title: "Barcoding Scanner",
    description: "Scan QR and barcodes with camera integration.",
    tag: "Utility",
    icon: "📷",
  },
];
