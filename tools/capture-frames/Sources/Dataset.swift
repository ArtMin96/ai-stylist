import Foundation

/// One row of the dataset's images.csv.
struct DatasetImage {
    let id: String
    let label: String
}

/// The CC0 clothing dataset (github.com/alexeygrigorev/clothing-dataset). Only images.csv, the
/// LICENSE file (licence evidence) and the individual images the generator tries are fetched, each
/// once, into the gitignored cache; nothing clones the repository.
struct Dataset {
    static let repository = "alexeygrigorev/clothing-dataset"
    static let homepage = "https://github.com/\(repository)"
    private static let branches = ["master", "main"]

    /// Dataset labels per shape family. Families without a label here (bag, generic) never use the
    /// dataset: bags are drawn, generic reuses the other families' bases.
    static let familyLabels: [String: [String]] = [
        "top": ["T-Shirt", "Shirt", "Longsleeve", "Polo", "Top", "Blouse", "Hoodie"],
        "long-bottom": ["Pants"],
        "short-bottom": ["Shorts", "Skirt"],
        "one-piece": ["Dress"],
        "outerwear": ["Outwear", "Blazer"],
        "shoes": ["Shoes"],
        "small-item": ["Hat"],
    ]

    let branch: String
    let cacheDirectory: URL
    let images: [DatasetImage]
    let licenceEvidence: String

    /// Loads the image list and checks the LICENSE file is CC0. Throws the reason the dataset cannot
    /// be used (offline, moved, or no CC0 statement); the caller then draws every family. The README
    /// never names the licence; the repository's LICENSE file holds the CC0 1.0 legal code.
    static func open(cacheDirectory: URL) throws -> Dataset {
        var reasons: [String] = []
        for branch in branches {
            let csvFile = cacheDirectory.appendingPathComponent("images-\(branch).csv")
            let licenceFile = cacheDirectory.appendingPathComponent("LICENSE-\(branch)")
            guard
                fetchOnce(rawURL(branch: branch, path: "images.csv"), to: csvFile),
                let csv = try? String(contentsOf: csvFile, encoding: .utf8)
            else {
                reasons.append("images.csv not reachable on branch \(branch)")
                continue
            }
            let images = try parse(csv: csv)
            guard
                fetchOnce(rawURL(branch: branch, path: "LICENSE"), to: licenceFile),
                let licence = try? String(contentsOf: licenceFile, encoding: .utf8)
            else {
                throw GeneratorError("LICENSE not reachable on branch \(branch); licence unverified")
            }
            guard let line = licence.split(separator: "\n").first(where: { $0.contains("CC0") }) else {
                throw GeneratorError("LICENSE on branch \(branch) does not state CC0; dataset not used")
            }
            let evidence = "LICENSE (\(branch)): \(line.trimmingCharacters(in: .whitespaces))"
            return Dataset(
                branch: branch, cacheDirectory: cacheDirectory, images: images, licenceEvidence: evidence)
        }
        throw GeneratorError(reasons.joined(separator: "; "))
    }

    /// The candidates for a family in a fixed order (sorted by image id), so every run picks the
    /// same images.
    func candidates(family: String) -> [DatasetImage] {
        guard let labels = Dataset.familyLabels[family] else { return [] }
        let wanted = Set(labels.map { $0.lowercased() })
        return images.filter { wanted.contains($0.label.lowercased()) }.sorted { $0.id < $1.id }
    }

    /// The cached image file, downloading it on first use. Nil when it cannot be fetched.
    func imageFile(_ image: DatasetImage) -> URL? {
        let name = image.id.hasSuffix(".jpg") ? image.id : "\(image.id).jpg"
        let file = cacheDirectory.appendingPathComponent("images").appendingPathComponent(name)
        guard Dataset.fetchOnce(Dataset.rawURL(branch: branch, path: "images/\(name)"), to: file) else {
            return nil
        }
        // A Git LFS pointer instead of a JPEG: fetch the stored object instead.
        if Dataset.isLFSPointer(file) {
            try? FileManager.default.removeItem(at: file)
            let media = "https://media.githubusercontent.com/media/\(Dataset.repository)/\(branch)/images/\(name)"
            guard Dataset.fetchOnce(media, to: file) else { return nil }
        }
        return file
    }

    private static func isLFSPointer(_ file: URL) -> Bool {
        guard let handle = try? FileHandle(forReadingFrom: file) else { return false }
        defer { try? handle.close() }
        guard let head = try? handle.read(upToCount: 32) else { return false }
        return String(decoding: head, as: UTF8.self).hasPrefix("version https://git-lfs")
    }

    private static func rawURL(branch: String, path: String) -> String {
        "https://raw.githubusercontent.com/\(repository)/\(branch)/\(path)"
    }

    private static func parse(csv: String) throws -> [DatasetImage] {
        let lines = csv.split(whereSeparator: \.isNewline).map { String($0) }
        guard let header = lines.first?.split(separator: ",").map({ String($0) }),
            let idColumn = header.firstIndex(of: "image"),
            let labelColumn = header.firstIndex(of: "label")
        else {
            throw GeneratorError("images.csv has no image and label columns")
        }
        return lines.dropFirst().compactMap { line in
            let fields = line.split(separator: ",", omittingEmptySubsequences: false).map { String($0) }
            guard fields.count > max(idColumn, labelColumn), !fields[idColumn].isEmpty else { return nil }
            return DatasetImage(id: fields[idColumn], label: fields[labelColumn])
        }
    }

    /// Downloads `url` to `file` unless a non-empty copy is already cached. curl -f turns an HTTP
    /// error into a failure instead of saving the error page.
    private static func fetchOnce(_ url: String, to file: URL) -> Bool {
        let fileManager = FileManager.default
        if let size = try? fileManager.attributesOfItem(atPath: file.path)[.size] as? Int, size > 0 {
            return true
        }
        let partial = file.appendingPathExtension("partial")
        do {
            try fileManager.createDirectory(
                at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            let curl = Process()
            curl.executableURL = URL(fileURLWithPath: "/usr/bin/curl")
            curl.arguments = [
                "-fsSL", "--retry", "2", "--connect-timeout", "15", "--max-time", "120", "-o", partial.path, url,
            ]
            try curl.run()
            curl.waitUntilExit()
            guard curl.terminationStatus == 0 else {
                try? fileManager.removeItem(at: partial)
                return false
            }
            try? fileManager.removeItem(at: file)
            try fileManager.moveItem(at: partial, to: file)
            return true
        } catch {
            try? fileManager.removeItem(at: partial)
            return false
        }
    }
}
