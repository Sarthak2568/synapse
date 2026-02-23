#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, models, transforms


def build_model(arch: str, num_classes: int, freeze_backbone: bool):
    if arch == "mobilenet_v3_small":
        model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
        in_features = model.classifier[3].in_features
        model.classifier[3] = nn.Linear(in_features, num_classes)
        if freeze_backbone:
            for p in model.features.parameters():
                p.requires_grad = False
        return model

    if arch == "efficientnet_b0":
        model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
        in_features = model.classifier[1].in_features
        model.classifier[1] = nn.Linear(in_features, num_classes)
        if freeze_backbone:
            for p in model.features.parameters():
                p.requires_grad = False
        return model

    model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
    in_features = model.fc.in_features
    model.fc = nn.Linear(in_features, num_classes)
    if freeze_backbone:
        for name, p in model.named_parameters():
            p.requires_grad = name.startswith("fc.")
    return model


def parse_args():
    p = argparse.ArgumentParser(description="Train and export cricket shot CNN.")
    p.add_argument("--data-dir", type=Path, required=True, help="Dataset root with class folders.")
    p.add_argument("--out-dir", type=Path, default=Path("backend/models"))
    p.add_argument("--arch", choices=["mobilenet_v3_small", "efficientnet_b0", "resnet50"], default="mobilenet_v3_small")
    p.add_argument("--epochs", type=int, default=10)
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--val-split", type=float, default=0.2)
    p.add_argument("--freeze-backbone", action="store_true")
    p.add_argument("--seed", type=int, default=42)
    return p.parse_args()


def main():
    args = parse_args()
    torch.manual_seed(args.seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    args.out_dir.mkdir(parents=True, exist_ok=True)

    input_size = 224
    mean = [0.485, 0.456, 0.406]
    std = [0.229, 0.224, 0.225]

    train_tf = transforms.Compose(
        [
            transforms.Resize((input_size, input_size)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.15, contrast=0.15),
            transforms.ToTensor(),
            transforms.Normalize(mean=mean, std=std),
        ]
    )
    val_tf = transforms.Compose(
        [
            transforms.Resize((input_size, input_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=mean, std=std),
        ]
    )

    full_dataset = datasets.ImageFolder(root=str(args.data_dir), transform=train_tf)
    class_to_idx = full_dataset.class_to_idx
    idx_to_class = {idx: label for label, idx in class_to_idx.items()}

    val_len = int(len(full_dataset) * args.val_split)
    train_len = len(full_dataset) - val_len
    train_ds, val_ds = random_split(full_dataset, [train_len, val_len])
    val_ds.dataset.transform = val_tf

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, num_workers=2)

    model = build_model(args.arch, num_classes=len(class_to_idx), freeze_backbone=args.freeze_backbone)
    model = model.to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam([p for p in model.parameters() if p.requires_grad], lr=args.lr)

    best_acc = 0.0
    best_state = None

    for epoch in range(args.epochs):
        model.train()
        running_loss = 0.0
        for images, labels in train_loader:
            images = images.to(device)
            labels = labels.to(device)
            optimizer.zero_grad()
            logits = model(images)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item()

        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images = images.to(device)
                labels = labels.to(device)
                preds = model(images).argmax(dim=1)
                correct += int((preds == labels).sum().item())
                total += int(labels.numel())

        val_acc = correct / max(total, 1)
        print(f"Epoch {epoch + 1}/{args.epochs} | loss={running_loss / max(len(train_loader), 1):.4f} | val_acc={val_acc:.4f}")
        if val_acc >= best_acc:
            best_acc = val_acc
            best_state = {k: v.cpu() for k, v in model.state_dict().items()}

    weights_path = args.out_dir / "cricket_shot_model.pth"
    torch.save(best_state or model.state_dict(), weights_path)

    (args.out_dir / "class_mapping.json").write_text(
        json.dumps({str(k): v for k, v in idx_to_class.items()}, indent=2)
    )
    (args.out_dir / "preprocess_config.json").write_text(
        json.dumps({"input_size": input_size, "mean": mean, "std": std}, indent=2)
    )
    (args.out_dir / "model_config.json").write_text(
        json.dumps(
            {
                "arch": args.arch,
                "num_classes": len(class_to_idx),
                "freeze_backbone": bool(args.freeze_backbone),
                "best_val_accuracy": round(best_acc, 6),
            },
            indent=2,
        )
    )
    print(f"Saved weights: {weights_path}")


if __name__ == "__main__":
    main()
