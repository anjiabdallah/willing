import { Router } from 'express';

import { setUserJWT, authorizeOnly } from './authorization.js';
import adminRouter from './routes/admin/index.js';
import indexRouter from './routes/organization/organizationIndex.js';
import postingRouter from './routes/organization/organizationPosting.js';
import userRouter from './routes/user.js';
import volunteerRouter from './routes/volunteer.js';

const api = Router();
api.use(setUserJWT);

api.use('/user', userRouter);
api.use('/admin', adminRouter);
api.use('/volunteer', volunteerRouter);

// Organization routes: public routes first, then protected routes
api.use('/organization', indexRouter);
api.use('/organization', authorizeOnly('organization'), postingRouter);

export default api;
