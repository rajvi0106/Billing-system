import pg from "pg";
const {Pool}=pg
pg.types.setTypeParser(1082, (val) => val);

const pool= new Pool({connectionString:process.env.DATABASE_URL,ssl: { rejectUnauthorized: false }})

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});
export default pool;
