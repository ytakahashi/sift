import { SkillsExtension, memorySkillFiles } from '@modelcontextprotocol/server/ext/skills';
import { readReviewSkillFiles } from './review-skill-files';

declare const __SIFT_REVIEW_SKILLS__: Record<string, string> | undefined;

export async function loadReviewSkills(): Promise<SkillsExtension> {
  // The distributed CLI embeds its skills. Running from source with tsx reads the
  // same files so development and the packaged CLI serve the same instructions.
  const files =
    typeof __SIFT_REVIEW_SKILLS__ === 'undefined'
      ? await readReviewSkillFiles()
      : __SIFT_REVIEW_SKILLS__;
  // The bundled catalog is tested at startup over stdio. Treat an invalid skill as a packaging error.
  return SkillsExtension.load(memorySkillFiles(files), { prefix: 'sift', strict: true });
}
