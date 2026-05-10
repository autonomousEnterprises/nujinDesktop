import { memo } from "react";
import AgentMarkdown from "./AgentMarkdown";
import VisualResponse from "./VisualResponse";

interface SmartMessageRendererProps {
  children: string;
}

const SmartMessageRenderer = memo(function SmartMessageRenderer({ children }: SmartMessageRendererProps) {
  const content = children.trim();
  
  // 1. Try to find the JSON block that contains "visual" or "actions"
  // We use a more robust extraction that handles multiple blocks or surrounding text.
  let jsonToParse = "";
  let startIdx = -1;
  let lastIdx = -1;

  // Find all possible JSON-like blocks and try to parse the one that looks like our protocol
  const protocolMatches = [...content.matchAll(/\{[\s\S]*?"visual"[\s\S]*?\}/g)];
  
  if (protocolMatches.length > 0) {
    // Take the LAST one (most likely the final response)
    const match = protocolMatches[protocolMatches.length - 1];
    jsonToParse = match[0];
    startIdx = match.index!;
    lastIdx = startIdx + jsonToParse.length;
  } else {
    // Fallback to the old method if the regex fails for some reason
    const s = content.indexOf('{');
    const e = content.lastIndexOf('}');
    if (s !== -1 && e !== -1 && e > s) {
      const potential = content.substring(s, e + 1);
      if (potential.includes('"visual"') || potential.includes('"actions"')) {
        jsonToParse = potential;
        startIdx = s;
        lastIdx = e + 1;
      }
    }
  }

  if (jsonToParse) {
    try {
      // 1. Try to parse as-is
      let data;
      try {
        data = JSON.parse(jsonToParse);
      } catch (e) {
        // 2. If parsing fails, try to repair truncated JSON
        let repaired = jsonToParse.trim();
        const openBraces = (repaired.match(/\{/g) || []).length;
        const closeBraces = (repaired.match(/\}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/\]/g) || []).length;
        
        for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
        for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
        
        data = JSON.parse(repaired);
      }

      const visualData = data.visual || data;
      const textBefore = content.substring(0, startIdx).trim();
      const textAfter = content.substring(lastIdx).trim();

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
