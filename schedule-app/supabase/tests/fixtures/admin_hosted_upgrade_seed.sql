-- Synthetic rows only, applied to a newly imported public schema in Docker.
insert into public.admins(user_id,role) values('upgrade-admin','superadmin'),('upgrade-monitor','monitor');
insert into public.system_config(id,flags) values('global','{"enableFriends":true,"adminNotes":{"upgrade-student":"Private upgrade note"},"configHistory":[{"flags":{"adminNotes":{"upgrade-student":"Old note"}}}],"scheduledConfigDeploys":[{"flags":{"enableFriends":false},"at":"2099-01-01T00:00:00Z"}]}');
insert into public.profiles(user_id,courses,email) values('upgrade-student','{"BMD":"A","_name":"Upgrade Student"}','upgrade@example.test');
insert into public.app_controls(id,payload) values('global','{}');
insert into public.app_controls_drafts(section,payload,base_revision,updated_by) values('navigation','{"items":{},"order":[]}',0,'upgrade-admin');
insert into public.schedule_cache(id,payload) values('latest',jsonb_build_object('CLASSES',jsonb_build_array(jsonb_build_object('date',to_char((now() at time zone 'Asia/Kolkata')::date+1,'YYYY-MM-DD'),'code','BMD','section','A','start','09:00','end','10:00','room','A101','type','class','name','BMD'))));
insert into public.feedback(user_id,message) values('upgrade-student','Synthetic support request');
insert into public.board_posts(id,user_id,kind,title,reported_by) values('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','upgrade-author','ask','Synthetic legacy reported post','["upgrade-student"]');
