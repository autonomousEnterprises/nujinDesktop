import React, { memo } from "react";
import AgentMarkdown from "./AgentMarkdown";
import VisualResponse from "./VisualResponse";

interface SmartMessageRendererProps {
  children: string;
}

const SmartMessageRenderer = memo(function SmartMessageRenderer({ children }: SmartMessageRendererProps) {
  const content = children.trim();
  
  // Try to detect if the response is a JSON visual message
  // 1. Direct JSON
  // 2. JSON wrapped in markdown blocks
  let jsonToParse = content;
  
  if (!content.startsWith("{")) {
    const jsonBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonBlockMatch) {
      jsonToParse = jsonBlockMatch[1].trim();
    }
  }

  if (jsonToParse.startsWith("{") && jsonToParse.endsWith("}")) {
    try {
      const data = JSON.parse(jsonToParse);
      // Check if it looks like our VisualResponse schema
      if (data && (data.visual || data.blocks || data.type === "visual" || data.metrics || data.title || data.rows)) {
        const visualData = data.visual || data;
        return <VisualResponse data={visualData} />;
      }
    } catch (e) {
      // Not valid JSON or not our schema, fall back to markdown
    }
  }

  // Fallback to normal markdown
  return <AgentMarkdown>{children}</AgentMarkdown>;
});

export default SmartMessageRenderer;
