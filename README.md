# Pankhuri Verma Portfolio

A lightweight static portfolio built with plain HTML, CSS and JavaScript.

It does not require:
- Wix or Squarespace
- WordPress
- Node.js
- a database
- a paid hosting plan

## Website pages

- `index.html` — homepage
- `about.html` — philosophy, why hire me, testimonials
- `work.html` — business problems, case studies, AI approach
- `play.html` — music, community, teaching and mentoring
- `404.html` — not-found page
- `assets/` — stylesheet, JavaScript, favicon and portfolio PDF

## Changes to make before publishing

Search the files for the following items:

2. `pankhurirk@gmail.com`  
   This is currently used for the email link. Replace it if you prefer a different public email address.

3. `Portfolio PDF`  
   Replace `assets/Pankhuri-Verma-Portfolio.pdf` with your latest résumé if you want the button to download your CV instead.

4. Testimonials  
   The present quotations use thematic attribution. Replace them with named recommendations and job titles where you have permission.

5. Case-study language and numbers  
   Check every metric before publication and remove anything confidential.

## Preview the website on your computer

The easiest method is to open `index.html` in a web browser.

For a closer simulation of a hosted website, open a terminal inside this folder and run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Publish directly with GitHub Pages

1. Sign in to GitHub.
2. Create a new public repository, for example `portfolio`.
3. Upload every file and folder from this package. Do not upload only the enclosing folder.
4. Open the repository's **Settings**.
5. Open **Pages** under **Code and automation**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Select the `main` branch and `/(root)`.
8. Save and wait for GitHub to publish the site.

The temporary address will normally look like:

```text
https://YOUR-GITHUB-USERNAME.github.io/portfolio/
```

Relative links are used throughout the site, so it works both in a project repository and on a custom domain.

## Connect your own domain through GitHub Pages

1. In the repository, open **Settings → Pages**.
2. Enter the domain in **Custom domain**.
3. GitHub will show the DNS configuration required.
4. Add those DNS records at the company where the domain is registered.
5. After DNS has propagated, enable **Enforce HTTPS**.

This package already contains a `CNAME` file for `pankhuri-verma.com`. Keep that file in the repository root.

## Alternative: GitHub repository + Cloudflare Pages

You can keep the same repository on GitHub and let Cloudflare deploy it.

1. In Cloudflare, open **Workers & Pages**.
2. Create a Pages project and connect GitHub.
3. Select this repository.
4. Use `main` as the production branch.
5. Leave the build command blank.
6. Use `/` as the output directory if Cloudflare permits it; for a plain static project, the repository root contains the deployable files.
7. Deploy.
8. Add your domain under the project's **Custom domains** settings.

After the connection is active, every push to the GitHub repository triggers a new deployment.

## Editing later

For small text changes, open the HTML file directly on GitHub:

1. Select the file.
2. Click the pencil icon.
3. Edit the wording.
4. Choose **Commit changes**.

GitHub Pages or Cloudflare Pages will republish the change automatically.


## Domain configured in this version

- Custom domain: `pankhuri-verma.com`
- LinkedIn: `https://www.linkedin.com/in/pankhuri`
- GitHub Pages `CNAME` file: included
- SEO sitemap and robots file: included

## Photographs in this version

- Home: red professional portrait
- About and Why Hire Me: close crop of the red portrait
- Work: editorial floral/chandelier detail from the red photograph
- Play: blue performance photograph

Both JPEG and WebP versions are included for browser compatibility and faster loading.
