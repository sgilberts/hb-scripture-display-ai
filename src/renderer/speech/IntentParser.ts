export function parseSpokenReference(text: string): string | null {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return null;

  // Word to number map
  const numbers: Record<string, string> = {
    "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
    "eleven": "11", "twelve": "12", "thirteen": "13", "fourteen": "14",
    "fifteen": "15", "sixteen": "16", "seventeen": "17", "eighteen": "18",
    "nineteen": "19", "twenty": "20", "thirty": "30", "forty": "40",
    "fifty": "50", "sixty": "60", "seventy": "70", "eighty": "80",
    "ninety": "90", "hundred": "100"
  };

  // Replace common numbers spoken as words with digits
  const words = normalized.split(/\s+/);
  const textWithDigits = words.map(w => numbers[w] || w).join(" ");

  // Handle formats like: [book] chapter [X] verse [Y], or [book] [X] [Y]
  // Extract book names including prefixes like first/second
  const regex = /^(first\s+|second\s+|third\s+|1\s+|2\s+|3\s+)?([a-z]+)\s+(?:chapter\s+)?(\d+)(?:\s+(?:verse\s+)?(\d+))?$/i;
  
  const match = textWithDigits.match(regex);
  if (!match) return null;

  let prefix = match[1] ? match[1].trim() : "";
  if (prefix === "first") prefix = "1";
  if (prefix === "second") prefix = "2";
  if (prefix === "third") prefix = "3";
  
  const book = match[2].charAt(0).toUpperCase() + match[2].slice(1);
  const chapter = match[3];
  const verse = match[4];

  const fullBook = prefix ? `${prefix} ${book}` : book;

  if (verse) {
    return `${fullBook} ${chapter}:${verse}`;
  }
  
  return `${fullBook} ${chapter}`;
}
