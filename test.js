const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://rshyxnoulxnnkhbjmiwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzaHl4bm91bHhubmtoYmptaXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTY5MjksImV4cCI6MjA5OTY5MjkyOX0.TElfsR50Bvzrm8TS2KmRucuB0cUDbRoK06OH4XsL7C4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: topic, error } = await supabase
    .from('topics')
    .select('*, scripts(*, scenes(*))')
    .eq('id', 'eb1f942f-3e18-4b88-9d67-9e281af572a4')
    .single();
    
  console.log('Error:', error);
  console.log('Topic:', JSON.stringify(topic, null, 2));
}
test();
