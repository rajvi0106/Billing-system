import PG from "pg";
const {Pool}=PG

const pool= new Pool({connectionString:process.env.DATABASE_URL})

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});
export default pool;
