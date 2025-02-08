# [LichtClark.github.io]
# [clarkie.de]

Welcome to my open-source website, now hosted on GitHub Pages and managed with Cloudflare DNS under the domain clarkie.de. This project showcases the power of combining free hosting services with custom domain management for a professional web presence. This guide outlines the setup.

## Contents:
- [Introduction](#introduction)
- [GitHub Pages Setup](#github-pages-setup)
- [Cloudflare DNS Configuration](#cloudflare-dns-configuration)
- [SSL Certificate](#ssl-certificate)
- [Benefits of This Setup](#benefits-of-this-setup)
- [Challenges and Solutions](#challenges-and-solutions)
- [Future Improvements](#future-improvements)
- [Inspiration](#inspiration)
- [Responsibility](#responsibility)
- [Citations](#citations)
- [License](#license)

## Introduction

This website represents a journey from traditional hosting to a modern, cost-effective solution using GitHub Pages and Cloudflare DNS. By leveraging these services, we've created a robust, secure, and easily maintainable web presence at clarkie.de.

## GitHub Pages Setup

To replicate this setup on GitHub Pages:

1. Create a GitHub repository named `<username>.github.io`.
2. Clone the repository to your local machine.
3. Add your website files to the repository.
4. Push the changes to GitHub.
5. Go to repository settings > Pages.
6. Enable GitHub Pages and select the branch to deploy from.
7. Add your custom domain (clarkie.de) in the Custom domain field.
8. Create a `CNAME` file in the root of your repository containing your domain name (e.g., `clarkie.de`).

## Cloudflare DNS Configuration

Configuring Cloudflare DNS for use with GitHub Pages (with Hetzner as the domain registrar):

1.  **Hetzner Configuration: Update Nameservers**
    *   Log into your Hetzner account and go to the Domains section.
    *   For your domain, replace the existing nameserver entries with Cloudflare's nameservers. These are typically:
        *   `NS aiden.ns.cloudflare.com`
        *   `NS aleena.ns.cloudflare.com`
        *   **Important:** This delegates DNS management from Hetzner to Cloudflare.

2.  **Cloudflare Configuration: Add DNS Records**

    *   Log in to your Cloudflare account and select your domain.
    *   Add the following DNS records:

        *   **A Records (for apex domain @ or yourdomain.com)**

            *   Type: A
            *   Name: @ (This represents your domain name directly, e.g., clarkie.de)
            *   Content: 185.199.108.153
            *   Content: 185.199.109.153
            *   Content: 185.199.110.153
            *   Content: 185.199.111.153
            *   Proxy status: DNS only (Gray cloud) - **Important initial setting**

        *   **CNAME Record (for the 'www' subdomain)**

            *   Type: CNAME
            *   Name: www
            *   Content: `<username>.github.io` (Replace `<username>` with your GitHub username)
            *   Proxy status: DNS only (Gray cloud) - **Important initial setting**

    *   **Note:** The "Proxy status" should initially be set to "DNS only" (gray cloud). This allows GitHub Pages to properly provision an SSL certificate for your domain. Once the certificate is active and your site is working correctly, you *can* consider enabling the Cloudflare proxy (orange cloud). However, be aware that enabling the proxy *before* the certificate is provisioned or *after* it expires might cause issues.

3.  **Propagation:** Allow time for DNS propagation (usually 24-48 hours).

## SSL Certificate

GitHub Pages and Cloudflare both provide SSL/TLS certificates:

1. In GitHub Pages settings, enable "Enforce HTTPS". This ensures all traffic is served over HTTPS.
2. In Cloudflare, go to the SSL/TLS tab and set SSL mode to "Full". This encrypts traffic between Cloudflare and your origin server (GitHub Pages).

## Benefits of This Setup

1. Cost-effective: Free hosting through GitHub Pages and Cloudflare's free plan.
2. Easy maintenance: Update your website by pushing changes to your GitHub repository.
3. Version control: Full history of your website changes through Git.
4. Collaboration: Easy to work with others using GitHub's collaboration features.
5. Performance: Cloudflare's global CDN ensures fast loading times worldwide.
6. Security: Free SSL certificate and automatic HTTPS enforcement.
7. Enhanced Security and Performance:  Cloudflare provides DDoS protection, CDN capabilities, and other security features.

## Challenges and Solutions

1. Limited server-side functionality: Overcome by using client-side JavaScript or integrating third-party services for dynamic content.
2. Build process for complex sites: Utilize GitHub Actions for automated builds and deployments of static site generators like Jekyll or Hugo.
3. Large media files: Use Git LFS (Large File Storage) or external services like AWS S3 for hosting large media files.
4. Cloudflare Configuration Complexity: Cloudflare offers many advanced features. Start with basic settings and gradually explore advanced options.
5. Potential SSL Issues:  Incorrect Cloudflare SSL settings can lead to website errors. Ensure "Full" SSL mode is enabled and that the GitHub Pages SSL certificate is properly provisioned before enabling Cloudflare's proxy features.

## Future Improvements

1. Implement a headless CMS for easier content management.
2. Set up a CI/CD pipeline for automated testing and deployment.
3. Integrate analytics to track visitor engagement.
4. Optimize images and assets for faster loading times.
5. Implement a progressive web app (PWA) for offline capabilities.
6. Explore advanced Cloudflare features for enhanced security and performance.

## Inspiration

This project draws inspiration from the GitHub Pages documentation and the broader trend of JAMstack architecture. It demonstrates how modern web technologies can be leveraged to create efficient, secure, and scalable websites.

## Responsibility

This open-source website is provided for educational and research purposes only. The owner assumes no responsibility for any misuse or damage resulting from the use of this information. All actions on this site may be logged for security purposes.

## Citations
[1] https://www.blunix.com/blog/how-to-configure-a-hetzner-domains-dns-records-for-cloudflare.html
[2] https://www.reddit.com/r/hetzner/comments/18czutm/i_want_to_use_cloudflare_with_hetzner/
[3] https://community.cloudflare.com/t/setup-cloudflare-on-hetzner/59595
[4] https://www.reddit.com/r/hetzner/comments/18wy2l8/migrate_dns_from_hetzner_to_cloudflare/?tl=de
[5] https://community.cloudflare.com/t/trying-to-set-up-domain-on-hetzner-nginx-box/316006
[6] https://www.hetzner.com/dns-console/
[7] https://www.webhostingtalk.com/showthread.php?t=1897662
[8] https://www.reddit.com/r/hetzner/comments/18wy2l8/migrate_dns_from_hetzner_to_cloudflare/
[9] https://community.cloudflare.com/t/configure-ptr-record-in-hetzner-for-cloudflare/635898


## License

This project is licensed under Creative Commons Zero v1.0 Universal. This means you are free to use, modify, and distribute the content without attribution, even for commercial purposes.
