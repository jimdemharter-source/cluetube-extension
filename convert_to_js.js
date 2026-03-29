const fs = require('fs');
const path = require('path');

const projectDir = "c:\\Users\\jimde\\Desktop\\Job Stuff\\Investment Stuff\\League of legends Tools";

const rosterJsonPath = path.join(projectDir, "champion_roster.json");
const synergyJsonPath = path.join(projectDir, "jungle_synergies.json");

const rosterJsPath = path.join(projectDir, "champion_roster_data.js");
const synergyJsPath = path.join(projectDir, "jungle_synergies_data.js");

try {
    // Convert Roster
    if (fs.existsSync(rosterJsonPath)) {
        const rosterData = fs.readFileSync(rosterJsonPath, 'utf8');
        const rosterJsContent = `const FULL_CHAMPION_ROSTER = ${rosterData};\n`;
        fs.writeFileSync(rosterJsPath, rosterJsContent);
        console.log(`Created ${rosterJsPath}`);
    } else {
        console.error("Roster JSON not found!");
    }

    // Convert Synergies
    if (fs.existsSync(synergyJsonPath)) {
        const synergyData = fs.readFileSync(synergyJsonPath, 'utf8');
        const synergyJsContent = `const JUNGLE_SYNERGY_DATA = ${synergyData};\n`;
        fs.writeFileSync(synergyJsPath, synergyJsContent);
        console.log(`Created ${synergyJsPath}`);
    } else {
        console.error("Synergy JSON not found!");
    }

} catch (e) {
    console.error("Error converting files:", e);
}
