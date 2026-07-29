/**
 * Reports which build is actually in production.
 *
 * Vercel has no public, unauthenticated API for this — every deployment
 * endpoint that carries `meta.githubCommitSha` needs a bearer token, and none
 * of the response headers on a deployment name the commit. So rather than
 * interrogating Vercel, the deployment reports the commit itself: the platform
 * injects these variables at build time, and this route reads them back.
 *
 * That turns "is my push live?" into:
 *
 *     curl -s https://<host>/api/version | jq .commit
 *
 * `force-dynamic` matters — prerendering would freeze one build's values into
 * static HTML and defeat the point.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA;

  return Response.json(
    {
      commit: commit ?? null,
      commitShort: commit?.slice(0, 7) ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
      environment: process.env.VERCEL_ENV ?? "local",
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      builtFor: process.env.VERCEL_URL ?? null,
    },
    {headers: {"cache-control": "no-store"}},
  );
}
