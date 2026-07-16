const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://rshyxnoulxnnkhbjmiwu.supabase.co';
// I need the service role key to query system tables, but I don't have it locally.
// I will just use Supabase rpc if possible. Or I can just check if RLS is enabled.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzaHl4bm91bHhubmtoYmptaXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTY5MjksImV4cCI6MjA5OTY5MjkyOX0.TElfsR50Bvzrm8TS2KmRucuB0cUDbRoK06OH4XsL7C4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  // Delete the older duplicate video for this topic
  const { data: videos } = await supabase
    .from('videos')
    .select('id, created_at')
    .eq('topic_id', 'c393e21e-77f4-44ce-aff4-506fb65ded34')
    .order('created_at', { ascending: false });
    
  console.log('Videos found:', videos?.length);
  if (videos && videos.length > 1) {
    const idsToDelete = videos.slice(1).map(v => v.id);
    const { error } = await supabase.from('videos').delete().in('id', idsToDelete);
    console.log('Deleted duplicates:', idsToDelete, 'Error:', error);
  } else {
    console.log('No duplicates to clean.');
  }
}
test();
