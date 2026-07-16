'use client';

import { useState } from 'react';
import { regenerateSceneImage } from '@/features/assets/actions';

export function RegenerateSceneImageButton({ topicId, sceneId, imagePrompt }: { topicId: string, sceneId: string, imagePrompt: string }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleRegenerate = async () => {
    setIsGenerating(true);
    try {
      await regenerateSceneImage(topicId, sceneId, imagePrompt);
    } catch (error: any) {
      alert(`Failed to regenerate image: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button 
      onClick={handleRegenerate}
      disabled={isGenerating}
      style={{
        marginTop: '0.5rem',
        padding: '0.4rem 0.8rem',
        background: '#374151',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: isGenerating ? 'not-allowed' : 'pointer',
        fontSize: '0.85rem'
      }}
    >
      {isGenerating ? 'Regenerating...' : 'Regenerate Image'}
    </button>
  );
}
