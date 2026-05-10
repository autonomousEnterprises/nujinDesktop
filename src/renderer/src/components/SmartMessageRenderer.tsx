import React, { memo } from "react";
import AgentMarkdown from "./AgentMarkdown";
import VisualResponse from "./VisualResponse";

interface SmartMessageRendererProps {
  children: string;
}

const SmartMessageRenderer = memo(function SmartMessageRenderer({ children }: SmartMessageRendererProps) {
  const content = children.trim();
  
  // Find the JSON block. We look for the FIRST { and the LAST } that contains "visual" or "actions"
  const startIdx = content.indexOf('{');
  const lastIdx = content.lastIndexOf('}');
  
  if (startIdx !== -1 && lastIdx !== -1 && lastIdx > startIdx) {
    const potentialJson = content.substring(startIdx, lastIdx + 1);
    
    // Quick check if it's likely our protocol
    if (potentialJson.includes('"visual"') || potentialJson.includes('"actions"')) {
      try {
        const data = JSON.parse(potentialJson);
        const visualData = data.visual || data;
        const textBefore = content.substring(0, startIdx).trim();
        const textAfter = content.substring(lastIdx + 1).trim();

        return (
          <div className="flex flex-col gap-4">
            {textBefore && <AgentMarkdown>{textBefore}</AgentMarkdown>}
            <VisualResponse data={visualData} hideHeader={!!textBefore} />
            {textAfter && <AgentMarkdown>{textAfter}</AgentMarkdown>}
          </div>
        );
      } catch (e) {
        // Partial JSON or invalid - fall back to markdown
      }
    }
  }

  // Fallback to normal markdown
  return <AgentMarkdown>{children}</AgentMarkdown>;
});

export default SmartMessageRenderer;
