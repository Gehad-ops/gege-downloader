import { BLOCK, expect, test, type PlexoApp } from './fixtures'

// The LinkGrabber's journey: a link is collected (checked) without downloading, then handed to
// New download, where the folder and networks are chosen before it starts.

async function stubNativeUi(plexo: PlexoApp, destination: string): Promise<void> {
  await plexo.evaluateMain(({ dialog }, dest) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [dest] })) as never
  }, destination)
}

test('a pasted link collects in the LinkGrabber, then downloads through New download', async ({
  plexo,
  serve,
  dirs
}) => {
  const origin = await serve({ size: 8 * BLOCK })
  const page = plexo.page

  // Collect: paste the link into the LinkGrabber's box.
  await page.getByRole('button', { name: 'LinkGrabber' }).click()
  await page.getByRole('textbox', { name: 'Links to add' }).fill(origin.url())
  await page.getByRole('button', { name: 'Add links' }).click()

  // Checked, not started: the file's name and Ready status show.
  await expect(page.getByText('test.bin', { exact: true })).toBeVisible()
  await expect(page.getByText('Ready', { exact: true })).toBeVisible()

  // Download hands it to New download, which asks where to save (and networks/Alternate).
  await page.getByRole('checkbox', { name: 'Select all links' }).check()
  await page.getByRole('button', { name: 'Download (1)' }).click()

  await stubNativeUi(plexo, dirs.dest)
  await page.getByRole('button', { name: 'Change' }).click()
  await plexo.expectNextDownload(origin.sha256)
  await page.getByRole('button', { name: 'Download', exact: true }).click()

  await plexo.waitForHttpStatus('completed')
})
