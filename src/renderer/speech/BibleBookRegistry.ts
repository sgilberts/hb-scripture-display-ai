export interface BibleBookInfo {
  canonicalName: string;
  testament: "OT" | "NT";
  aliases: string[];
}

const RAW_BIBLE_BOOKS: BibleBookInfo[] = [
  // Old Testament
  { canonicalName: "Genesis", testament: "OT", aliases: ["genesis", "gen", "genna sis", "jen"] },
  { canonicalName: "Exodus", testament: "OT", aliases: ["exodus", "exo", "exadus"] },
  { canonicalName: "Leviticus", testament: "OT", aliases: ["leviticus", "lev", "levitecus"] },
  { canonicalName: "Numbers", testament: "OT", aliases: ["numbers", "number", "num"] },
  { canonicalName: "Deuteronomy", testament: "OT", aliases: ["deuteronomy", "deuteronomy chapter", "diteronomi", "detronomi", "diteronomy", "detronomy", "deut", "deu", "deuter", "dewteronomy", "dew turn on me", "do ter on a me"] },
  { canonicalName: "Joshua", testament: "OT", aliases: ["joshua", "josh"] },
  { canonicalName: "Judges", testament: "OT", aliases: ["judges"] },
  { canonicalName: "Ruth", testament: "OT", aliases: ["ruth"] },
  { canonicalName: "1 Samuel", testament: "OT", aliases: ["1 samuel", "1st samuel", "first samuel", "one samuel", "wan samuel", "1 samiel", "1 sammuel", "1 samael", "first samiel", "first sammuel", "first samael", "one samiel", "one sammuel", "one samael", "wan samiel", "wan sammuel", "wan samael", "1samuel"] },
  { canonicalName: "2 Samuel", testament: "OT", aliases: ["2 samuel", "2nd samuel", "second samuel", "two samuel", "to samuel", "too samuel", "tu samuel", "2 samiel", "2 sammuel", "2 samael", "second samiel", "second sammuel", "second samael", "two samiel", "two sammuel", "two samael", "to samiel", "to sammuel", "to samael", "too samiel", "too sammuel", "too samael", "tu samiel", "tu sammuel", "tu samael", "2samuel"] },
  { canonicalName: "1 Kings", testament: "OT", aliases: ["1 kings", "1st kings", "first kings", "one kings", "wan kings", "1kings"] },
  { canonicalName: "2 Kings", testament: "OT", aliases: ["2 kings", "2nd kings", "second kings", "two kings", "to kings", "too kings", "tu kings", "2kings"] },
  { canonicalName: "1 Chronicles", testament: "OT", aliases: ["1 chronicles", "1st chronicles", "first chronicles", "one chronicles", "wan chronicles", "1chronicles", "chess chronicles"] },
  { canonicalName: "2 Chronicles", testament: "OT", aliases: ["2 chronicles", "2nd chronicles", "second chronicles", "two chronicles", "to chronicles", "too chronicles", "tu chronicles", "2chronicles"] },
  { canonicalName: "Ezra", testament: "OT", aliases: ["ezra"] },
  { canonicalName: "Nehemiah", testament: "OT", aliases: ["nehemiah", "neh", "near my", "near me", "here my at", "hey maya", "knee high maya", "nee hi ya", "ni hi ya", "ne he my ah"] },
  { canonicalName: "Esther", testament: "OT", aliases: ["esther", "ester"] },
  { canonicalName: "Job", testament: "OT", aliases: ["job"] },
  { canonicalName: "Psalms", testament: "OT", aliases: ["psalms", "psalm", "psa", "salm", "sams"] },
  { canonicalName: "Proverbs", testament: "OT", aliases: ["proverbs", "prov", "proverb"] },
  { canonicalName: "Ecclesiastes", testament: "OT", aliases: ["ecclesiastes", "ecclesiasties", "ecclesiastis", "eclesiasties", "eklisiastis", "ecc"] },
  { canonicalName: "Song of Solomon", testament: "OT", aliases: ["song of solomon", "song", "songs", "songs of solomon", "song of songs", "holy song", "canticles"] },
  { canonicalName: "Isaiah", testament: "OT", aliases: ["isaiah", "iezaya", "aezaya", "aezaiya", "isaiya", "isa", "isiah"] },
  { canonicalName: "Jeremiah", testament: "OT", aliases: ["jeremiah", "jer", "jeremia"] },
  { canonicalName: "Lamentations", testament: "OT", aliases: ["lamentations", "lam"] },
  { canonicalName: "Ezekiel", testament: "OT", aliases: ["ezekiel", "ezekial", "ezakeeal", "ezekeel", "ezakiel", "eze", "ezek"] },
  { canonicalName: "Daniel", testament: "OT", aliases: ["daniel", "dan"] },
  { canonicalName: "Hosea", testament: "OT", aliases: ["hosea", "hos"] },
  { canonicalName: "Joel", testament: "OT", aliases: ["joel"] },
  { canonicalName: "Amos", testament: "OT", aliases: ["amos", "amo"] },
  { canonicalName: "Obadiah", testament: "OT", aliases: ["obadiah", "oba", "obadia"] },
  { canonicalName: "Jonah", testament: "OT", aliases: ["jonah", "jon"] },
  { canonicalName: "Micah", testament: "OT", aliases: ["micah", "mic", "mica"] },
  { canonicalName: "Nahum", testament: "OT", aliases: ["nahum", "nahoom", "nayhum", "nah"] },
  { canonicalName: "Habakkuk", testament: "OT", aliases: ["habakkuk", "habbakuk", "habakuk", "habakook", "habbakook", "hab"] },
  { canonicalName: "Zephaniah", testament: "OT", aliases: ["zephaniah", "zeph", "zefaniah", "zephania"] },
  { canonicalName: "Haggai", testament: "OT", aliases: ["haggai", "hag", "hagai"] },
  { canonicalName: "Zechariah", testament: "OT", aliases: ["zechariah", "zech", "zecariah", "zachariah"] },
  { canonicalName: "Malachi", testament: "OT", aliases: ["malachi", "mal", "malaki"] },

  // New Testament
  { canonicalName: "Matthew", testament: "NT", aliases: ["matthew", "matt", "mathew"] },
  { canonicalName: "Mark", testament: "NT", aliases: ["mark", "mar"] },
  { canonicalName: "Luke", testament: "NT", aliases: ["luke", "luk"] },
  { canonicalName: "John", testament: "NT", aliases: ["john", "jon", "jn"] },
  { canonicalName: "Acts", testament: "NT", aliases: ["acts", "act"] },
  { canonicalName: "Romans", testament: "NT", aliases: ["romans", "rom", "roman"] },
  { canonicalName: "1 Corinthians", testament: "NT", aliases: ["1 corinthians", "1st corinthians", "first corinthians", "one corinthians", "wan corinthians", "1corinthians", "first corintians", "one corintians", "wan corintians"] },
  { canonicalName: "2 Corinthians", testament: "NT", aliases: ["2 corinthians", "2nd corinthians", "second corinthians", "two corinthians", "to corinthians", "too corinthians", "tu corinthians", "2corinthians", "second corintians", "two corintians", "to corintians", "too corintians", "tu corintians"] },
  { canonicalName: "Galatians", testament: "NT", aliases: ["galatians", "gal", "gelatians"] },
  { canonicalName: "Ephesians", testament: "NT", aliases: ["ephesians", "eph", "efesians"] },
  { canonicalName: "Philippians", testament: "NT", aliases: ["philippians", "phil", "filipians"] },
  { canonicalName: "Colossians", testament: "NT", aliases: ["colossians", "col", "colosians"] },
  { canonicalName: "1 Thessalonians", testament: "NT", aliases: ["1 thessalonians", "1st thessalonians", "first thessalonians", "one thessalonians", "wan thessalonians", "1thessalonians", "first tesalonians", "one tesalonians", "wan tesalonians", "first tesalonions", "one tesalonions", "wan tesalonions"] },
  { canonicalName: "2 Thessalonians", testament: "NT", aliases: ["2 thessalonians", "2nd thessalonians", "second thessalonians", "two thessalonians", "to thessalonians", "too thessalonians", "tu thessalonians", "2thessalonians", "second tesalonians", "two tesalonians", "to tesalonians", "too tesalonians", "tu tesalonians", "second tesalonions", "two tesalonions", "to tesalonions", "too tesalonions", "tu tesalonions"] },
  { canonicalName: "1 Timothy", testament: "NT", aliases: ["1 timothy", "1st timothy", "first timothy", "one timothy", "wan timothy", "1timothy"] },
  { canonicalName: "2 Timothy", testament: "NT", aliases: ["2 timothy", "2nd timothy", "second timothy", "two timothy", "to timothy", "too timothy", "tu timothy", "2timothy"] },
  { canonicalName: "Titus", testament: "NT", aliases: ["titus", "tit"] },
  { canonicalName: "Philemon", testament: "NT", aliases: ["philemon", "phlm"] },
  { canonicalName: "Hebrews", testament: "NT", aliases: ["hebrews", "heb", "hebrew"] },
  { canonicalName: "James", testament: "NT", aliases: ["james", "jas"] },
  { canonicalName: "1 Peter", testament: "NT", aliases: ["1 peter", "1st peter", "first peter", "one peter", "wan peter", "1peter"] },
  { canonicalName: "2 Peter", testament: "NT", aliases: ["2 peter", "2nd peter", "second peter", "two peter", "to peter", "too peter", "tu peter", "2peter"] },
  { canonicalName: "1 John", testament: "NT", aliases: ["1 john", "1st john", "first john", "one john", "wan john", "1john"] },
  { canonicalName: "2 John", testament: "NT", aliases: ["2 john", "2nd john", "second john", "two john", "to john", "too john", "tu john", "2john"] },
  { canonicalName: "3 John", testament: "NT", aliases: ["3 john", "3rd john", "third john", "three john", "3john"] },
  { canonicalName: "Jude", testament: "NT", aliases: ["jude"] },
  { canonicalName: "Revelation", testament: "NT", aliases: ["revelation", "rev", "revelations"] },
];

const BOOK_ABBREVIATIONS: Record<string, string[]> = {
  Genesis: ["gen", "ge", "gn"],
  Exodus: ["exod", "exo", "ex"],
  Leviticus: ["lev", "le", "lv"],
  Numbers: ["num", "nu", "nm", "nb"],
  Deuteronomy: ["deut", "deu", "dt"],
  Joshua: ["josh", "jos", "jsh"],
  Judges: ["judg", "jdg", "jg", "jdgs"],
  Ruth: ["ruth", "rth", "ru"],
  "1 Samuel": ["1 sam", "1 sa", "1 sm", "1sam", "1sa", "1sm", "i sam", "i samuel"],
  "2 Samuel": ["2 sam", "2 sa", "2 sm", "2sam", "2sa", "2sm", "ii sam", "ii samuel"],
  "1 Kings": ["1 kgs", "1 ki", "1 kin", "1kings", "1kgs", "1ki", "i kings"],
  "2 Kings": ["2 kgs", "2 ki", "2 kin", "2kings", "2kgs", "2ki", "ii kings"],
  "1 Chronicles": ["1 chr", "1 chron", "1 ch", "1chronicles", "1chr", "1ch", "i chronicles"],
  "2 Chronicles": ["2 chr", "2 chron", "2 ch", "2chronicles", "2chr", "2ch", "ii chronicles"],
  Ezra: ["ezra", "ezr"],
  Nehemiah: ["neh", "ne"],
  Esther: ["esth", "est", "es"],
  Job: ["job", "jb"],
  Psalms: ["ps", "psa", "psalm", "psalms", "pss"],
  Proverbs: ["prov", "pro", "prv", "pr"],
  Ecclesiastes: ["eccl", "ecc", "qoh", "qoheleth"],
  "Song of Solomon": ["song", "songs", "song sol", "song of songs", "sos", "cant", "canticles"],
  Isaiah: ["isa", "is"],
  Jeremiah: ["jer", "je", "jr"],
  Lamentations: ["lam", "la"],
  Ezekiel: ["ezek", "eze", "ezk"],
  Daniel: ["dan", "da", "dn"],
  Hosea: ["hos", "ho"],
  Joel: ["joel", "jl"],
  Amos: ["amos", "am"],
  Obadiah: ["obad", "oba", "ob"],
  Jonah: ["jonah", "jon", "jnh"],
  Micah: ["mic", "mc"],
  Nahum: ["nah", "na"],
  Habakkuk: ["hab", "hb"],
  Zephaniah: ["zeph", "zep", "zp"],
  Haggai: ["hag", "hg"],
  Zechariah: ["zech", "zec", "zc"],
  Malachi: ["mal", "ml"],
  Matthew: ["matt", "mat", "mt"],
  Mark: ["mark", "mrk", "mk", "mr"],
  Luke: ["luke", "luk", "lk"],
  John: ["john", "jhn", "jn"],
  Acts: ["acts", "act", "ac"],
  Romans: ["rom", "ro", "rm"],
  "1 Corinthians": ["1 cor", "1 co", "1cor", "1co", "i cor", "i corinthians"],
  "2 Corinthians": ["2 cor", "2 co", "2cor", "2co", "ii cor", "ii corinthians"],
  Galatians: ["gal", "ga"],
  Ephesians: ["eph", "ephes"],
  Philippians: ["phil", "php", "pp"],
  Colossians: ["col", "co"],
  "1 Thessalonians": ["1 thess", "1 thes", "1 th", "1thess", "1th", "i thessalonians"],
  "2 Thessalonians": ["2 thess", "2 thes", "2 th", "2thess", "2th", "ii thessalonians"],
  "1 Timothy": ["1 tim", "1 ti", "1tm", "1tim", "i timothy"],
  "2 Timothy": ["2 tim", "2 ti", "2tm", "2tim", "ii timothy"],
  Titus: ["titus", "tit", "ti"],
  Philemon: ["philem", "phlm", "phm", "pm"],
  Hebrews: ["heb", "he"],
  James: ["jas", "jam", "jm"],
  "1 Peter": ["1 pet", "1 pe", "1 pt", "1pet", "1pe", "i peter"],
  "2 Peter": ["2 pet", "2 pe", "2 pt", "2pet", "2pe", "ii peter"],
  "1 John": ["1 jn", "1 jo", "1 john", "1jn", "1jo", "i john"],
  "2 John": ["2 jn", "2 jo", "2 john", "2jn", "2jo", "ii john"],
  "3 John": ["3 jn", "3 jo", "3 john", "3jn", "3jo", "iii john"],
  Jude: ["jude", "jud"],
  Revelation: ["rev", "re", "the revelation", "revelations"],
};

const NUMBER_WORDS: Record<string, string[]> = {
  "1": ["1", "1st", "first", "one", "wan", "i"],
  "2": ["2", "2nd", "second", "two", "to", "too", "tu", "ii"],
  "3": ["3", "3rd", "third", "three", "iii"],
};

function compactAlias(alias: string): string {
  return alias.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function uniqueAliases(aliases: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const alias of aliases) {
    const normalized = alias.toLowerCase().replace(/\s+/g, " ").trim();
    const key = compactAlias(normalized);
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function generatedAliasesForBook(canonicalName: string): string[] {
  const aliases = [
    canonicalName,
    canonicalName.replace(/\s+/g, ""),
    ...(BOOK_ABBREVIATIONS[canonicalName] ?? []),
  ];

  const numberedMatch = canonicalName.match(/^([123])\s+(.+)$/);
  if (numberedMatch) {
    const [, number, bookName] = numberedMatch;
    const numberWords = NUMBER_WORDS[number] ?? [number];
    for (const numberWord of numberWords) {
      aliases.push(`${numberWord} ${bookName}`);
      aliases.push(`${numberWord}${bookName}`);
    }
  }

  return uniqueAliases(aliases);
}

export const BIBLE_BOOKS: BibleBookInfo[] = RAW_BIBLE_BOOKS.map((book) => ({
  ...book,
  aliases: uniqueAliases([
    ...generatedAliasesForBook(book.canonicalName),
    ...book.aliases,
  ]),
}));
