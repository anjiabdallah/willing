import { Router } from 'express';
import database from '../db/index.js';

const api = Router();

// GET /signin
// POST /signup
// ...

// Example:
// api.get("/", async (req, res) => {
//   const query = database.selectFrom('volunteer_account').selectAll();
//   const rows = await query.execute();

//   res.json({
//     volunteers: rows
//   });
// });

export default api;
