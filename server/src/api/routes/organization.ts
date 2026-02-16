import { Router } from 'express';

import { authorizeOnly } from '../authorization.js';
import indexRouter from './organization/organizationIndex.js';
import postingRouter from './organization/organizationPosting.js';

const organizationRouter = Router();

organizationRouter.use(indexRouter);

organizationRouter.use(authorizeOnly('organization'));

organizationRouter.use(postingRouter);

export default organizationRouter;
