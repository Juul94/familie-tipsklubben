import { Linking } from 'react-native';

// Map superliga.dk full team names to app team names
const TEAM_NAME_MAP: Record<string, string> = {
  'F.C. København': 'FCK',
  'FC København': 'FCK',
  'Brøndby IF': 'Brøndby',
  'FC Midtjylland': 'FCM',
  'AGF': 'AGF',
  'FC Nordsjælland': 'FCN',
  'Randers FC': 'Randers',
  'Silkeborg IF': 'Silkeborg',
  'Viborg FF': 'Viborg',
  'SønderjyskE': 'Sønderjyske',
  'Sønderjyske': 'Sønderjyske',
  'Sønderjyske Fodbold': 'Sønderjyske',
  'OB': 'OB',
  'Odense Boldklub': 'OB',
  'Vejle Boldklub': 'Vejle',
  'FC Fredericia': 'FC Fredericia',
  'Lyngby Boldklub': 'Lyngby',
  'Lyngby BK': 'Lyngby',
  'AC Horsens': 'Horsens',
  'Horsens': 'Horsens',
  'AaB': 'AaB',
  'Aalborg BK': 'AaB',
};

function mapTeamName(rawName: string): string {
  return TEAM_NAME_MAP[rawName.trim()] ?? rawName.trim();
}

interface ScrapedMatch {
  homeTeam: string;
  awayTeam: string;
  date: Date;
}

interface ScrapedRound {
  roundNumber: number;
  matches: ScrapedMatch[];
  deadline: Date; // Day before first match at 23:59
}

const MONTH_MAP: Record<string, number> = {
  januar: 0, februar: 1, marts: 2, april: 3, maj: 4, juni: 5,
  juli: 6, august: 7, september: 8, oktober: 9, november: 10, december: 11,
};

/**
 * Fetch and parse matches for a given round from superliga.dk
 *
 * HTML structure per match:
 *   <div class="teams">
 *     <div class="team-logo"><span>Viborg FF</span> ...
 *     <div class="score">...</div>
 *     <div class="team-logo">... <span>F.C. København</span></div>
 *   </div>
 *   <div class="match-info">
 *     <strong><span class="round"><span>1. Spillerunde</span></span> - TV3 Sport</strong>
 *     <div>18. juli kl. 19:00 - Energi Viborg Arena</div>
 *   </div>
 */
export async function fetchSuperligaRound(roundNumber: number): Promise<ScrapedRound | null> {
  try {
    const response = await fetch('https://superliga.dk/kampprogram/');
    const html = await response.text();

    // Split HTML into chunks at each "linked-row" boundary (each = one match)
    const chunks = html.split('class="linked-row"');
    const roundStr = `${roundNumber}. Spillerunde`;

    const matches: ScrapedMatch[] = [];
    const seen = new Set<string>();

    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Check if this chunk belongs to the requested round
      if (!chunk.includes(roundStr)) continue;

      // Extract ALL <span>...</span> contents to find team names
      // Team names are in spans inside "team-logo" divs
      // Pattern: <span>Viborg FF</span> or <span>F.C. København</span>
      const allSpans = [...chunk.matchAll(/<span>([^<]{2,})<\/span>/g)]
        .map(m => m[1].trim())
        .filter(name => {
          // Filter out non-team spans (scores, round info, etc.)
          const lower = name.toLowerCase();
          return !lower.includes('spillerunde') &&
                 !lower.includes('status') &&
                 !/^\d+\s*-\s*\d+$/.test(name) &&
                 name.length > 1;
        });

      if (allSpans.length < 2) continue;

      // First team span = home, second = away
      const homeTeam = mapTeamName(allSpans[0]);
      const awayTeam = mapTeamName(allSpans[1]);

      const key = `${homeTeam}-${awayTeam}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Extract date: "8. august kl. 18:00"
      const dateMatch = chunk.match(/(\d{1,2})\.\s*(januar|februar|marts|april|maj|juni|juli|august|september|oktober|november|december)\s+kl\.\s*(\d{1,2}):(\d{2})/i);
      let matchDate = new Date();
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const month = MONTH_MAP[dateMatch[2].toLowerCase()] ?? 0;
        const hour = parseInt(dateMatch[3], 10);
        const minute = parseInt(dateMatch[4], 10);
        const now = new Date();
        let year = now.getFullYear();
        if (month < now.getMonth() - 2) year++;
        matchDate = new Date(year, month, day, hour, minute);
      }

      matches.push({ homeTeam, awayTeam, date: matchDate });
    }

    if (matches.length === 0) return null;

    // Sort by date
    matches.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Deadline: day before first match at 23:59
    const firstMatch = matches[0].date;
    const deadline = new Date(firstMatch);
    deadline.setDate(deadline.getDate() - 1);
    deadline.setHours(23, 59, 0, 0);

    return { roundNumber, matches, deadline };
  } catch (error) {
    console.error('Error fetching superliga data:', error);
    return null;
  }
}

/**
 * Open superliga.dk match schedule in browser
 */
export function openSuperligaKampprogram() {
  Linking.openURL('https://superliga.dk/kampprogram/');
}
