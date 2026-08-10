// this logic was written to test the update counts functionality when 50 requests were fired to db but the db registered only req therefore we will move on to next step 

// import pool from "../db.js";

// const updatecounts=async(req,res)=>{
//     const {customerID}=req.params
//     console.log("customerId received:", customerID, typeof customerID);
//     try {
//         const response=await pool.query("select total_count from customer_usage_counts where customer_id=$1",[customerID])
//         if(response.rows.length===0){
//             return res.status(404).json({error:"customer not found",customer_id:customerID});
//         }
//         const event_count=response.rows[0].total_count;
//         const newCount=event_count+1;
//         await pool.query("update customer_usage_counts set total_count=$1 where customer_id=$2",[newCount,customerID]);
//         res.status(200).json({status:"count updated"})
//     } catch (error) {
//         console.error(error.message);
//         res.status(500).json({ error: "cannot get total event count" });
//     }
// }

// export default updatecounts;

import pool from "../db.js";

const updatecounts=async(req,res)=>{
    const {customerID}=req.params
    console.log("customerId received:", customerID, typeof customerID);
    try {
        const response=await pool.query("update customer_usage_counts set total_count=total_count+1 where customer_id=$1 returning *",[customerID]);
        if(response.rows.length===0){
            return res.status(404).json({error:"customer not found",customer_id:customerID});
        }
        res.status(200).json({status:"count updated",total_count:response.rows[0].total_count});
    } catch (error) {
        console.error(error.message);
        res.status(500).json({error:"cannot get total event count"});
    }
}
export default updatecounts