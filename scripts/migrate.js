import "dotenv/config";
import fs from "fs";
import path  from "path";
import { fileURLToPath } from "url";
import PG, { Pool } from "pg";

const  __filename= fileURLToPath(import.meta.url);
const __dirname= path.dirname(__filename);

async function run() {
    const pool = new Pool({connectionString: process.env.DATABASE_URL})
    const dir= path.join(__dirname,"..","migrations");
    const files=fs.readdirSync(dir).filter((f)=> f.endsWith(".sql")).sort();
    for(const file of files){
        console.log(`running migration file ${file}`);
        const sql=fs.readFileSync(path.join(dir,file),'utf8');
        await pool.query(sql);
    }
    console.log("migrations done successfully");
    await pool.end();

}run().catch((err)=>{
    console.error("Migration failed:", err);
    process.exit(1);
})