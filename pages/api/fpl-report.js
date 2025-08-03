// /api/fpl-report.js
import axios from 'axios';

const FPL_USER_ID = process.env.FPL_USER_ID;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// --- MOCK DATA ---
const mockEntryData = {
  player_first_name: "Mocky",
  player_last_name: "McMockface",
  started_event: 3,
  bank: 15,
  last_deadline_total_transfers: 2,
  summary_overall_points: 42,
  transfers_remaining: 1,
  squad: [
    { name: "Erling Haaland", team: "MCI", points: 25, cost: 120, position: "Forward" },
    { name: "Trent Alexander-Arnold", team: "LIV", points: 15, cost: 75, position: "Defender" },
    { name: "Alexis Mac Allister", team: "BHA", points: 4, cost: 65, position: "Midfielder" },
    { name: "Mohamed Salah", team: "LIV", points: 0, cost: 120, position: "Midfielder" }, // injured
    { name: "James Maddison", team: "LEI", points: 15, cost: 80, position: "Midfielder" },
    { name: "Ivan Toney", team: "BRE", points: 13, cost: 90, position: "Forward" },
    // add more players as needed
  ],
  injury_alerts: [
    { player: "Mohamed Salah", team: "LIV", status: "Doubtful" }
  ],
  captain_suggestion: "Erling Haaland",
  fixture_difficulty: {
    MCI: ["🟢", "🟢", "🟠"],
    LIV: ["🟠", "🔴", "🟠"],
    LEI: ["🟢", "🟢", "🟢"],
    BHA: ["🟠", "🟠", "🟠"],
    BRE: ["🟢", "🟠", "🟢"],
  },
};

// --- Simple Transfer Suggestion Engine ---
function suggestTransfers(squad, fixtureDifficulty, injuryAlerts) {
  const lowFormThreshold = 5;
  const goodFormThreshold = 10;

  const injuredPlayers = injuryAlerts.map((alert) => alert.player);

  const toTransferOut = squad.filter(
    (p) => p.points < lowFormThreshold || injuredPlayers.includes(p.name)
  );

  const availablePlayers = [
    { name: "James Maddison", team: "LEI", points: 15, position: "Midfielder" },
    { name: "Ivan Toney", team: "BRE", points: 13, position: "Forward" },
  ];

  const toTransferIn = availablePlayers.filter(
    (p) => p.points > goodFormThreshold && fixtureDifficulty[p.team]?.[0] === "🟢"
  );

  const suggestedTransfers = toTransferOut
    .slice(0, toTransferIn.length)
    .map((outPlayer, i) => ({
      out: outPlayer.name,
      in: toTransferIn[i].name,
      reason: "Replace due to low form or injury with better fixture & form",
    }));

  return suggestedTransfers;
}

// --- Generate Telegram report message ---
function generateReport(data) {
  let report = `📊 *FPL Weekly Report - GW${data.started_event}*\n\n`;
  report += `👤 Team: ${data.player_first_name} ${data.player_last_name}\n`;
  report += `💰 Bank: £${(data.bank / 10).toFixed(1)}m\n`;
  report += `📈 Total Points (last GW): ${data.summary_overall_points}\n`;
  report += `🔄 Transfers remaining: ${data.transfers_remaining}\n\n`;

  report += `🧑‍🤝‍🧑 *Squad Highlights:*\n`;
  data.squad.forEach((p) => {
    report += `- ${p.name} (${p.team}) - ${p.points} pts - £${(p.cost / 10).toFixed(1)}m\n`;
  });

  if (data.injury_alerts.length > 0) {
    report += `\n⚠️ *Injury Alerts:*\n`;
    data.injury_alerts.forEach((alert) => {
      report += `- ${alert.player} (${alert.team}) - ${alert.status}\n`;
    });
  }

  report += `\n🔄 *Suggested Transfers:*\n`;
  data.suggested_transfers.forEach((t) => {
    report += `- OUT: ${t.out}\n- IN: ${t.in}\n- Reason: ${t.reason}\n\n`;
  });

  report += `🎯 *Captain Suggestion:*\n- ${data.captain_suggestion}\n\n`;

  report += `📅 *Fixture Difficulty Next 3 GWs:*\n`;
  Object.entries(data.fixture_difficulty).forEach(([team, diffs]) => {
    report += `- ${team}: ${diffs.join("")}\n`;
  });

  report += `\n---\nReady to hit “Confirm” on transfers and captain pick?`;

  return report;
}

// --- Telegram send function ---
async function sendToTelegram(message) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Missing Telegram config — skipping send.");
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "Markdown",
    });
  } catch (err) {
    console.error("❌ Telegram send failed:", err.message || err);
    throw err;
  }
}

export default async function handler(req, res) {
  try {
    // For now, using mock data instead of live API
    const data = { ...mockEntryData };

    // Run the transfer suggestion engine
    data.suggested_transfers = suggestTransfers(
      data.squad,
      data.fixture_difficulty,
      data.injury_alerts
    );

    // Generate the report
    const report = generateReport(data);

    // Send the report to Telegram
    await sendToTelegram(report);

    res.status(200).json({ success: true, message: "Report sent!", report });
  } catch (err) {
    console.error("Final error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
