const fetch = require("node-fetch");
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config();
const supabase = require('@supabase/supabase-js');

// Create a single supabase client for interacting with your database
const client = supabase.createClient(process.env.SUPABASE_URL, process.env.SUPABASE_TOKEN);

const uuid = ''+process.env.UUID;

function logError(err, func) {
    console.error(`[${func}] ${JSON.stringify(err)}`);
    const date = new Date();
    writeFileSyncRecursive(`errors/${func}_${date.toISOString()}.log`, JSON.stringify(err), 'utf8');
}

function findProfile() {
    fetch(`https://api.hypixel.net/player?key=${process.env.APIKEY}&uuid=${process.env.UUID}`)
        .then(result => result.json())
        .then((data) => {
            // Log the owner's player UUID
            console.log(data.player.stats.SkyBlock);
        });
}

async function getCurrentMember() {
    const data = await fetch(`https://api.hypixel.net/skyblock/profile?key=${process.env.APIKEY}&profile=${process.env.PROFILE}`)
        .then(result => {
            return result.json()
        })
        .then((data) => {
            const members = data.profile.members;
            const member = members[uuid.replace(/-/g, "")];
            if (!member) {
                console.error("Member not found.");
            }
            return member;
        });
    return data;
}

/*function diff(obj1, obj2) {
    const result = {};
    if (Object.is(obj1, obj2)) {
        return undefined;
    }
    if (!obj2 || typeof obj2 !== 'object') {
        return obj2;
    }
    Object.keys(obj1 || {}).concat(Object.keys(obj2 || {})).forEach(key => {
        if(obj2[key] !== obj1[key] && !Object.is(obj1[key], obj2[key])) {
            result[key] = obj2[key];
        }
        if(typeof obj2[key] === 'object' && typeof obj1[key] === 'object') {
            const value = diff(obj1[key], obj2[key]);
            if (value !== undefined) {
                result[key] = value;
            }
        }
    });
    return result;
}*/

function writeFileSyncRecursive(filename, content, charset) {
    // -- normalize path separator to '/' instead of path.sep,
    // -- as / works in node for Windows as well, and mixed \\ and / can appear in the path
    let filepath = filename.replace(/\\/g,'/');

    // -- preparation to allow absolute paths as well
    let root = '';
    if (filepath[0] === '/') {
        root = '/';
        filepath = filepath.slice(1);
    }
    else if (filepath[1] === ':') {
        root = filepath.slice(0,3);   // c:\
        filepath = filepath.slice(3);
    }

    // -- create folders all the way down
    const folders = filepath.split('/').slice(0, -1);  // remove last item, file
    folders.reduce(
        (acc, folder) => {
            const folderPath = acc + folder + '/';
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath);
            }
            return folderPath
        },
        root // first 'acc', important
    );

    // -- write file
    fs.writeFileSync(root + filepath, content, charset);
}

async function saveUser(data) {
    const stats = data.stats;
    const purse = data.coin_purse || 0;
    const visitedZones = data.visited_zones || [];
    const lastDeath = data.last_death;
    const fairySoulsCollected = data.fairy_souls_collected;
    const armor = data.inv_armor;
    const inventory = data.inv_contents;
    const enderChest = data.ender_chest_contents;
    const craftedGenerators = data.crafted_generators || [];

    const date = new Date(data.last_save);

    const { error } = await client
        .from('user_data')
        .insert([
            { date, purse, last_death: lastDeath, fairy_souls_collected: fairySoulsCollected, stats, visited_zones: visitedZones, armor, inventory, ender_chest: enderChest, crafted_generators: craftedGenerators }
        ]);
    if (error) {
        logError(error, 'saveUser');
    }
}

async function saveSkills(data) {
    const alchemy = data.experience_skill_alchemy || 0;
    const carpentry = data.experience_skill_carpentry || 0;
    const combat = data.experience_skill_combat || 0;
    const enchanting = data.experience_skill_enchanting || 0;
    const farming = data.experience_skill_farming || 0;
    const fishing = data.experience_skill_fishing || 0;
    const foraging = data.experience_skill_foraging || 0;
    const mining = data.experience_skill_mining || 0;
    const runecrafting = data.experience_skill_runecrafting || 0;
    const taming = data.experience_skill_taming || 0;

    const date = new Date(data.last_save);

    const { error } = await client
        .from('skills')
        .insert([
            { alchemy, carpentry, combat, enchanting, farming, fishing, foraging, mining, runecrafting, taming, date }
        ]);
    if (error) {
        logError(error, 'saveSkills');
    }
}

async function saveCollection(data) {
    let collection = data.collection;
    const date = new Date(data.last_save);
    if (!collection) {
       collection = {};
    }
    const { error } = await client
        .from('collection')
        .insert([
            { collection, date }
        ]);
    if (error) {
        logError(error, 'saveCollection');
    }
}

async function saveObjectives(data) {
    let objectives = data.objectives;
    const date = new Date(data.last_save);
    if (!objectives) {
        objectives = {};
    }
    const { error } = await client
        .from('objectives')
        .insert([
            { objectives, date }
        ]);
    if (error) {
        logError(error, 'saveObjectives');
    }
}

async function saveQuests(data) {
    let quests = data.quests;
    const date = new Date(data.last_save);
    if (!quests) {
        quests = {};
    }
    const { error } = await client
        .from('quests')
        .insert([
            { quests, date }
        ]);
    if (error) {
        logError(error, 'saveQuests');
    }
}

async function savePets(data) {
    let pets = data.pets;
    const date = new Date(data.last_save);
    if (!pets) {
        pets = {};
    }
    const { error } = await client
        .from('pets')
        .insert([
            { pets, date }
        ]);
    if (error) {
        logError(error, 'savePets');
    }
}

function saveLastDate(date) {
    fs.writeFile(`${uuid}.json`, JSON.stringify({date}), function (err) {
        if (err) {
            logError(err, 'saveLastDate');
        }
    });
}

function getLastDate() {
    if (!fs.existsSync(`${uuid}.json`)) return 0;
    return JSON.parse(fs.readFileSync(`${uuid}.json`, 'utf8')).date;
}

async function main() {
    const current = await getCurrentMember();
    const lastSave = current.last_save;
    const previousSave = getLastDate();
    console.log(lastSave);
    if (previousSave === lastSave) {
        console.info("nothing changed")
        return; // nothing changed
    }
    saveLastDate(lastSave);
    await saveUser(current);
    await saveSkills(current);
    await saveCollection(current);
    await saveObjectives(current);
    await saveQuests(current);
    await savePets(current);
}

function start() {
    const args = process.argv.slice(2);
    if (args.length > 0 && args[0] === "profile") {
        findProfile();
        return;
    }
    main();
    cron.schedule('* * * * *', function() {
        console.log(`${new Date().toISOString()} - running.`);
        main();
    });

}

start();
