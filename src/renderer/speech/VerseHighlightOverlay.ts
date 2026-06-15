export function initializeVerseHighlightOverlay() {
  if (document.getElementById("verse-highlight-style")) return;

  const style = document.createElement("style");
  style.id = "verse-highlight-style";
  style.textContent = `
    .active-verse-highlight {
      background: rgba(16, 185, 129, 0.2) !important;
      border-left: 4px solid #10b981 !important;
      transition: background 0.3s ease-in-out;
    }
  `;
  document.head.appendChild(style);
}

export function highlightActiveVerse(reference: string) {
  // Clear old highlights
  document.querySelectorAll(".active-verse-highlight").forEach(el => {
    el.classList.remove("active-verse-highlight");
  });

  if (!reference) return;

  // Hacky but safe DOM traversal since we can't touch React
  // Look for elements that might contain the verse reference or text
  const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let currentNode = treeWalker.nextNode();

  while (currentNode) {
    if (currentNode.nodeValue?.includes(reference) || currentNode.nodeValue?.includes(reference.split(" ")[0])) {
      const parentElement = currentNode.parentElement;
      // Heuristic to ensure we highlight the container
      if (parentElement && parentElement.tagName !== "SCRIPT" && parentElement.tagName !== "STYLE") {
        let target: HTMLElement | null = parentElement;
        // Go up one or two levels to find the logical block if possible
        if (target.closest("button")) {
          target = target.closest("button");
        } else if (target.closest("li")) {
          target = target.closest("li");
        } else if (target.closest("div.border")) {
          target = target.closest("div.border");
        }
        
        if (target && !target.classList.contains("active-verse-highlight")) {
          target.classList.add("active-verse-highlight");
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          break; // Stop after first highlight to prevent full page coloring
        }
      }
    }
    currentNode = treeWalker.nextNode();
  }
}
