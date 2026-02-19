import { Router } from 'express';

import database from '../../../db/index.js';
import { authorizeOnly } from '../../authorization.js';
const volunteerPostingRouter = Router();

volunteerPostingRouter.use(authorizeOnly('volunteer'));

volunteerPostingRouter.get('/', async (req, res) => {
  const { location_name, start_timestamp, end_timestamp, skill } = req.query;

  let query = database
    .selectFrom('organization_posting')
    .innerJoin(
      'organization_account',
      'organization_account.id',
      'organization_posting.organization_id'
    )
    .selectAll('organization_posting')
    .select(['organization_account.name as organization_name'])
    .where('organization_posting.is_open', '=', true);
    
  if(location_name){
    query = query.where(
      'organization_posting.location_name',
      'ilike',
      `%${location_name}%`
    );
  }

  if(start_timestamp){
    query = query.where(
      'organization_posting.start_timestamp',
      'ilike',
      new Date(start_timestamp as string)
    );
  }

  if(end_timestamp){
    query = query.where(
      'organization_posting.end_timestamp',
      'ilike',
      new Date(end_timestamp as string)
    );
  }

  const postings = await query
    .orderBy('organization_posting.start_timestamp', 'asc')
    .execute()

  const postingIds = postings.map(p => p.id)

  const skills = postingIds.length > 0 ? await database
    .selectFrom('posting_skill')
    .selectAll()
    .where('posting_id', 'in', postingIds)
    .execute()
  : [];

  const skillsByPostingId = new Map<number, typeof skills>();

  skills.forEach((skillRow) => {
    if(!skillsByPostingId.has(skillRow.posting_id)){
      skillsByPostingId.set(skillRow.posting_id, []);
    }
    skillsByPostingId.get(skillRow.posting_id)!.push(skillRow);
  });

  let postingWithSkills = postings.map(posting => ({
    ...posting,
    skills: skillsByPostingId.get(posting.id) || [],
  }));

  if(skill){
    postingWithSkills = postingWithSkills.filter(posting => 
      posting.skills.some(s =>
        s.name.toLowerCase().includes((skill as string).toLowerCase())
      )
    );
  }

  res.json({postings: postingWithSkills});
});


export default volunteerPostingRouter;
