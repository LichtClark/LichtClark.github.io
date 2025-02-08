# [LichtClark.github.io]
# [clarkie.de]

Welcome to my open-source website, now hosted on GitHub Pages and managed with Hetzner DNS under the domain clarkie.de. This project showcases the power of combining free hosting services with custom domain management for a professional web presence.

## Contents:
- [Introduction](#introduction)
- [GitHub Pages Setup](#github-pages-setup)
- [Hetzner DNS Configuration](#hetzner-dns-configuration)
- [SSL Certificate](#ssl-certificate)
- [Benefits of This Setup](#benefits-of-this-setup)
- [Challenges and Solutions](#challenges-and-solutions)
- [Future Improvements](#future-improvements)
- [Inspiration](#inspiration)
- [Responsibility](#responsibility)
- [Citations](#citations)
- [License](#license)

## Introduction

This website represents a journey from traditional hosting to a modern, cost-effective solution using GitHub Pages and Hetzner DNS. By leveraging these services, we've created a robust, secure, and easily maintainable web presence at clarkie.de.

## GitHub Pages Setup

To replicate this setup on GitHub Pages:

1. Create a GitHub repository named `<username>.github.io`.
2. Clone the repository to your local machine.
3. Add your website files to the repository.
4. Push the changes to GitHub.
5. Go to repository settings > Pages.
6. Enable GitHub Pages and select the branch to deploy from.
7. Add your custom domain (clarkie.de) in the Custom domain field.

## Hetzner DNS Configuration

Configuring Hetzner DNS for use with GitHub Pages:

1. Log into your Hetzner account and access the DNS console.
2. Select the clarkie.de domain.
3. Add the following A records pointing to GitHub Pages IP addresses:
   - 185.199.108.153
   - 185.199.109.153
   - 185.199.110.153
   - 185.199.111.153
4. Add a CNAME record:
   - Host: www
   - Points to: <username>.github.io
5. Save the changes and allow time for DNS propagation (usually 24-48 hours).

## SSL Certificate

GitHub Pages automatically provisions and manages SSL certificates for custom domains:

1. Ensure "Enforce HTTPS" is enabled in your GitHub Pages settings.
2. GitHub will automatically issue and renew the SSL certificate.
3. This provides a secure HTTPS connection for your visitors at no additional cost.

## Benefits of This Setup

1. Cost-effective: Free hosting through GitHub Pages and affordable domain management with Hetzner.
2. Easy maintenance: Update your website by pushing changes to your GitHub repository.
3. Version control: Full history of your website changes through Git.
4. Collaboration: Easy to work with others using GitHub's collaboration features.
5. Performance: GitHub's global CDN ensures fast loading times worldwide.
6. Security: Free SSL certificate and automatic HTTPS enforcement.

## Challenges and Solutions

1. Limited server-side functionality: Overcome by using client-side JavaScript or integrating third-party services for dynamic content.
2. Build process for complex sites: Utilize GitHub Actions for automated builds and deployments of static site generators like Jekyll or Hugo.
3. Large media files: Use Git LFS (Large File Storage) or external services like AWS S3 for hosting large media files.

## Future Improvements

1. Implement a headless CMS for easier content management.
2. Set up a CI/CD pipeline for automated testing and deployment.
3. Integrate analytics to track visitor engagement.
4. Optimize images and assets for faster loading times.
5. Implement a progressive web app (PWA) for offline capabilities.

## Inspiration

This project draws inspiration from the GitHub Pages documentation and the broader trend of JAMstack architecture. It demonstrates how modern web technologies can be leveraged to create efficient, secure, and scalable websites.

## Responsibility

This open-source website is provided for educational and research purposes only. The owner assumes no responsibility for any misuse or damage resulting from the use of this information. All actions on this site may be logged for security purposes.

Here are all the sources mentioned in the search results:

1. GitHub Docs: Managing a custom domain for your GitHub Pages site[1][7]
2. GitHub repository: arcanemachine/hetzner-dns-tools[2]
3. Dev.to article: How to Add a Custom Domain to GitHub Pages (Hostinger Edition)[3]
4. GitHub repository: hetznercloud/awesome-hcloud[4]
5. YouTube video: How to add a Custom Domain on Github Pages[5]
6. GitHub repository: mconfalonieri/external-dns-hetzner-webhook[6]
7. Let's Encrypt client documentation: Hetzner DNS configuration[8]

These sources provide information on managing custom domains for GitHub Pages, Hetzner DNS tools, and related topics.

## Citations
[1] https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
[2] https://github.com/arcanemachine/hetzner-dns-tools
[3] https://dev.to/sidmohanty11/how-to-add-a-custom-domain-to-github-pages-hostinger-edition-p4p
[4] https://github.com/hetznercloud/awesome-hcloud
[5] https://www.youtube.com/watch?v=rIXWUJ5U8bY
[6] https://github.com/mconfalonieri/external-dns-hetzner-webhook
[7] https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site
[8] https://go-acme.github.io/lego/dns/hetzner/

## License

[CC0

This project is licensed under Creative Commons Zero v1.0 Universal. This means you are free to use, modify, and distribute the content without attribution, even for commercial purposes.

---
