//to check if there is any missing parameter before inserting in the db and also chekc if the for duplicate event
import pool from "../db.js"

const getparameters=async(req,res)=>{
    const {event_id,customer_id,event_type,occurred_at}=req.body;
    if(!event_id||!customer_id|| !event_type|| !occurred_at){
        return res.status(400).json({error:"missing parameters parameters are required",missing_fields: [event_id,customer_id,event_type,occurred_at]})
    }
    try {
        const response=await pool.query("insert into usage_events(event_id,customer_id,event_type,occurred_at) values($1,$2,$3,$4) on conflict do nothing returning *",[event_id,customer_id,event_type,occurred_at]);
        console.log("rowCount:",response.rowCount)
        if(response.rowCount===0){
            return res.status(200).json({status:"duplicate_event",event_id});
        }
        res.status(201).json({status:"created",event: response.rows[0]});
    } catch (error) {
        console.error(error)
        res.status(500).json({error:"internal server error"});
    }
}
export default getparameters;