const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://rshyxnoulxnnkhbjmiwu.supabase.co';
// I need the service role key to query system tables, but I don't have it locally.
// I will just use Supabase rpc if possible. Or I can just check if RLS is enabled.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzaHl4bm91bHhubmtoYmptaXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTY5MjksImV4cCI6MjA5OTY5MjkyOX0.TElfsR50Bvzrm8TS2KmRucuB0cUDbRoK06OH4XsL7C4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: topic } = await supabase
    .from('topics')
    .select('scripts(scenes(id, assets(id, type, file_url)))')
    .eq('id', 'c393e21e-77f4-44ce-aff4-506fb65ded34')
    .single();
    
  let updatedCount = 0;
  for (const scene of topic?.scripts?.[0]?.scenes || []) {
    for (const asset of scene.assets || []) {
      if (!asset.file_url.includes('?v=')) {
        await supabase
          .from('assets')
          .update({ file_url: `${asset.file_url}?v=${Date.now()}` })
          .eq('id', asset.id);
        updatedCount++;
      }
    }
  }
  
  console.log(`Updated ${updatedCount} assets with cache-busting timestamp.`);
}
test();
