do $$ declare p uuid; a uuid; b uuid; c uuid; x uuid; y uuid; z uuid; begin
 if exists(select 1 from workspace where demo=true) then return; end if;
 if exists(select 1 from workspace) or exists(select 1 from periods) then raise exception 'Refusing to seed a business workspace'; end if;
 insert into workspace values(1,'Harbour Distribution (fictional demo)',true,now(),now());
 insert into periods(code,name,currency,end_date,retention_until) values('DEMO','Distribution review','NZD',current_date,current_date+interval '8 years') returning id into p;
 insert into objects(period_id,code,name,segment,revenue_cents,direct_cents,evidence) values(p,'COAST','Coastal Retail','Retail',2400000,1400000,'Fictional sales ledger') returning id into a;
 insert into objects(period_id,code,name,segment,revenue_cents,direct_cents,evidence) values(p,'COAST-EXP','Coastal Express','Retail',800000,620000,'Fictional sales ledger') returning id into b;
 insert into objects(period_id,code,name,segment,revenue_cents,direct_cents,evidence) values(p,'RANGE','Range Wholesale','Wholesale',3500000,2100000,'Fictional sales ledger') returning id into c;
 insert into pools(period_id,code,name,cost_cents,unit,owner,review_due,evidence) values(p,'PICK','Order picking',900001,'order lines','Aroha',current_date-7,'Fictional warehouse cost ledger') returning id into x;
 insert into pools(period_id,code,name,cost_cents,unit,owner,review_due,evidence) values(p,'SUPPORT','Account support',480000,'minutes','Mere',current_date+30,'Fictional support cost ledger') returning id into y;
 insert into pools(period_id,code,name,cost_cents,unit,owner,review_due,evidence) values(p,'RETURNS','Returns handling',90000,'returns','',current_date-3,'') returning id into z;
 insert into drivers(period_id,pool_id,object_id,quantity,evidence) values
 (p,x,a,180,'Fictional pick log'),(p,x,b,240,'Fictional pick log'),(p,x,c,180,'Fictional pick log'),
 (p,y,a,300,'Fictional time log'),(p,y,b,900,'Fictional time log'),(p,y,c,400,'Fictional time log');
 insert into history(period_id,action,operator,detail) values(p,'seed','Demo','{"fictional":true}');
end $$;
