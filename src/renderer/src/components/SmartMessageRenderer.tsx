import React, { memo } from "react";
import AgentMarkdown from "./AgentMarkdown";
import VisualResponse from "./VisualResponse";

interface SmartMessageRendererProps {
  children: string;
}

const SmartMessageRenderer = memo(function SmartMessageRenderer({ children }: SmartMessageRendererProps) {
  const content = children.trim();
  
  // Try to find a JSON block in the content
  // We look for either a direct JSON string or a JSON block inside markdown
  const jsonMatch = content.match(/(\{[\s\S]*"visual"[\s\S]*\}|\{[\s\S]*"actions"[\s\S]*\})/);
  
  if (jsonMatch) {
    const jsonStr = jsonMatch[0];
    const textBefore = content.split(jsonStr)[0].trim();
    
    try {
      const data = JSON.parse(jsonStr);
      const visualData = data.visual || data;

      // If we have text before the JSON, we render the text normally 
      // and then the visual components (likely just actions/metrics)
      if (textBefore) {
        return (
          <div className="flex flex-col gap-4">
            <AgentMarkdown>{textBefore}</AgentMarkdown>
            <VisualResponse data={visualData} hideHeader={true} />
          </div>
        );
      }

      // If no text before, just render the full visual response
      return <VisualResponse data={visualData} />;
    } catch (e) {
      // JSON parse failed, fall back
    }
  }

  // Fallback to normal markdown
  return <AgentMarkdown>{children}</AgentMarkdown>;
});

export default SmartMessageRenderer;
