import { memo } from "react";
import AgentMarkdown from "./AgentMarkdown";
import VisualResponse from "./VisualResponse";

interface SmartMessageRendererProps {
  children: string;
}

const SmartMessageRenderer = memo(function SmartMessageRenderer({ children }: SmartMessageRendererProps) {
  const content = children.trim();
  
  let jsonToParse = "";
  let startIdx = -1;
  let lastIdx = -1;

  // 1. Try to find JSON inside markdown code blocks first (highest fidelity)
  const codeBlockMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonToParse = codeBlockMatch[1].trim();
    startIdx = content.indexOf("```json");
    lastIdx = startIdx + codeBlockMatch[0].length;
  } else {
    // 2. Fallback: Find the FIRST { and the LAST } that encompasses "visual" or "actions"
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const potential = content.substring(firstBrace, lastBrace + 1);
      if (potential.includes('"visual"') || potential.includes('"actions"')) {
        jsonToParse = potential;
        startIdx = firstBrace;
        lastIdx = lastBrace + 1;
      }
    }
  }

  if (jsonToParse) {
    try {
      let data;
      try {
        data = JSON.parse(jsonToParse);
      } catch (e) {
        // Try simple repair for truncation
        let repaired = jsonToParse.trim();
        // Close strings if needed
        if ((repaired.match(/"/g) || []).length % 2 !== 0) repaired += '"';
        
        const openBraces = (repaired.match(/\{/g) || []).length;
        const closeBraces = (repaired.match(/\}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/\]/g) || []).length;
        
        for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
        for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
        
        data = JSON.parse(repaired);
      }

      const visualData = data.visual || data;
      let textBefore = content.substring(0, startIdx).trim();
      let textAfter = content.substring(lastIdx).trim();

      // Clean up common artifacts
      if (textBefore.endsWith("```json")) textBefore = textBefore.slice(0, -7).trim();
      if (textBefore.endsWith("```")) textBefore = textBefore.slice(0, -3).trim();
      if (textAfter.startsWith("```")) textAfter = textAfter.slice(3).trim();

      return (
        <div className="flex flex-col gap-4">
          {textBefore && <AgentMarkdown>{textBefore}</AgentMarkdown>}
          <VisualResponse data={visualData} hideHeader={!!textBefore} />
          {textAfter && <AgentMarkdown>{textAfter}</AgentMarkdown>}
        </div>
      );
    } catch (e) {
      // Partial JSON or invalid - show a rescue card if we were expecting visual data
      if (jsonToParse.includes('"visual"') || content.includes('```json')) {
        return (
          <div className="flex flex-col gap-4">
            <VisualResponse 
              data={{ 
                title: "Incomplete Response", 
                subtitle: "The AI response was truncated or contains invalid JSON. Please try asking for a more concise summary.",
                status: "warning",
                actions: [{ label: "Retry Concise", command: "Give me a very short summary of the above results." }]
              }} 
            />
            <div className="opacity-40 grayscale scale-[0.98] origin-top">
              <AgentMarkdown>{children}</AgentMarkdown>
            </div>
          </div>
        );
      }
    }
  }


  // Fallback to normal markdown
  return <AgentMarkdown>{children}</AgentMarkdown>;
});

export default SmartMessageRenderer;
