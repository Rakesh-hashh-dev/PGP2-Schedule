import{expect,it,vi}from'vitest';
const rpc=vi.hoisted(()=>vi.fn());vi.mock('./supabase',()=>({supabase:{rpc}}));
import{reportContent}from'./adminModeration.js';
it('requires a confirmed report receipt and sends only target and reason fields',async()=>{
  const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';rpc.mockResolvedValueOnce({data:id});
  expect(await reportContent('board_post',id,'spam','Context')).toBe(id);
  expect(rpc).toHaveBeenCalledWith('report_content',{p_type:'board_post',p_id:id,p_reason:'spam',p_detail:'Context'});
  rpc.mockResolvedValueOnce({data:null});await expect(reportContent('board_post',id,'spam')).rejects.toThrow('not confirmed');
});
