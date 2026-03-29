const fs = require('fs');
const path = require('path');

const srcRoster = "c:\\Users\\jimde\\.gemini\\antigravity\\brain\\23e48a3f-2297-489f-8081-56c87388a519\\champion_roster.json";
const destRoster = "c:\\Users\\jimde\\Desktop\\Job Stuff\\Investment Stuff\\League of legends Tools\\champion_roster.json";

const srcSynergies = "c:\\Users\\jimde\\.gemini\\antigravity\\brain\\23e48a3f-2297-489f-8081-56c87388a519\\jungle_synergies.json";
const destSynergies = "c:\\Users\\jimde\\Desktop\\Job Stuff\\Investment Stuff\\League of legends Tools\\jungle_synergies.json";

try {
    if (fs.existsSync(srcRoster)) {
        fs.copyFileSync(srcRoster, destRoster);
        console.log(`Copied roster to ${destRoster}`);
    } else {
        console.error(`Source roster not found: ${srcRoster}`);
    }

    if (fs.existsSync(srcSynergies)) {
        fs.copyFileSync(srcSynergies, destSynergies);
        console.log(`Copied synergies to ${destSynergies}`);
    } else {
        console.error(`Source synergies not found: ${srcSynergies}`);
    }
} catch (e) {
    console.error("Error copying files:", e);
}
