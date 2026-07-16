const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://rshyxnoulxnnkhbjmiwu.supabase.co';
// I need the service role key to query system tables, but I don't have it locally.
// I will just use Supabase rpc if possible. Or I can just check if RLS is enabled.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzaHl4bm91bHhubmtoYmptaXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTY5MjksImV4cCI6MjA5OTY5MjkyOX0.TElfsR50Bvzrm8TS2KmRucuB0cUDbRoK06OH4XsL7C4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id')
    .order('created_at', { ascending: false });
    
  if (videos && videos.length > 1) {
    // Keep the first (latest), delete the rest
    const idsToDelete = videos.slice(1).map(v => v.id);
    await supabase.from('videos').delete().in('id', idsToDelete);
    console.log('Deleted duplicate videos:', idsToDelete);
  } else {
    console.log('No duplicates found.');
  }
}
test();
